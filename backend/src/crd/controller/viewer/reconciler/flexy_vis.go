package reconciler

import (
	"context"
	"fmt"

	"github.com/golang/glog"
	viewerV1beta1 "github.com/kubeflow/pipelines/backend/src/crd/pkg/apis/viewer/v1beta1"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/util/intstr"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	"sigs.k8s.io/controller-runtime/pkg/controller/controllerutil"
	"sigs.k8s.io/controller-runtime/pkg/reconcile"
)

const flexyVisTargetPort = 8501

const flexyVisDefaultImage = "dmitryb/kf-flexy-vis-loader:latest"
const gitSecret = "bot:Vnky9HGuzQ9FBn48DWbs" // move to secrets

type FlexyVis struct {
	reconcile *Reconciler
}

func (t *FlexyVis) Run(req reconcile.Request) (reconcile.Result, error) {
	r := t.reconcile

	view := &viewerV1beta1.Viewer{}
	if err := r.Get(context.Background(), req.NamespacedName, view); err != nil {
		if errors.IsNotFound(err) {
			// No viewer instance, so this may be the result of a delete.
			// Nothing to do.
			return reconcile.Result{}, nil
		}
		// Error reading the object - requeue the request.
		return reconcile.Result{}, err
	}

	flexyVis := &unstructured.Unstructured{}
	flexyVis.SetGroupVersionKind(schema.GroupVersionKind{
		Group:   "kubeflow.org",
		Kind:    "Viewer",
		Version: "v1beta1",
	})
	err := r.Get(context.Background(), req.NamespacedName, flexyVis)
	if err != nil {
		glog.Fatalf("%+v\n", err)
		return reconcile.Result{}, nil
	}

	spec := flexyVis.Object["spec"]
	flexyVisSpec := spec.(map[string]interface{})["flexyVisSpec"]

	// Check and maybe delete the oldest viewer before creating the next one.
	if err := r.maybeDeleteOldestViewer(view.Spec.Type, view.Namespace); err != nil {
		// Couldn't delete. Requeue.
		return reconcile.Result{Requeue: true}, err
	}

	// Set up potential deployment.
	dpl, err := t.deploymentFrom(view)
	t.setPodSpecForFlexyVis(view, &dpl.Spec.Template.Spec, flexyVisSpec.(map[string]interface{}))
	if err != nil {
		utilruntime.HandleError(err)
		// User error, don't requeue key.
		return reconcile.Result{}, nil
	}
	glog.Infof("%+v", dpl)

	// Set the deployment to be owned by the view instance. This ensures that
	// deleting the viewer instance will delete the deployment as well.
	if err := controllerutil.SetControllerReference(view, dpl, r.scheme); err != nil {
		// Error means that the deployment is already owned by some other instance.
		utilruntime.HandleError(err)
		return reconcile.Result{}, err
	}

	foundDpl := &appsv1.Deployment{}
	nsn := types.NamespacedName{Name: dpl.Name, Namespace: dpl.Namespace}
	if err := r.Client.Get(context.Background(), nsn, foundDpl); err != nil {
		if errors.IsNotFound(err) {
			// Create a new instance.
			if createErr := r.Client.Create(context.Background(), dpl); createErr != nil {
				utilruntime.HandleError(fmt.Errorf("error creating deployment: %v", createErr))
				return reconcile.Result{}, createErr
			}
		} else {
			// Some other error.
			utilruntime.HandleError(err)
			return reconcile.Result{}, err
		}
	}
	glog.Infof("Created new deployment with spec: %+v", dpl)

	// Set up a service for the deployment above.
	svc := t.serviceFrom(view, dpl.Name)
	// Set the service to be owned by the view instance as well.
	if err := controllerutil.SetControllerReference(view, svc, r.scheme); err != nil {
		// Error means that the service is already owned by some other instance.
		utilruntime.HandleError(err)
		return reconcile.Result{}, err
	}

	foundSvc := &corev1.Service{}
	nsn = types.NamespacedName{Name: svc.Name, Namespace: svc.Namespace}
	if err := r.Client.Get(context.Background(), nsn, foundSvc); err != nil {
		if errors.IsNotFound(err) {
			// Create a new instance.
			if createErr := r.Client.Create(context.Background(), svc); createErr != nil {
				utilruntime.HandleError(fmt.Errorf("error creating service: %v", createErr))
				return reconcile.Result{}, createErr
			}
		} else {
			// Some other error.
			utilruntime.HandleError(err)
			return reconcile.Result{}, err
		}
	}
	glog.Infof("Created new service with spec: %+v", svc)

	return reconcile.Result{}, nil
}

func (t *FlexyVis) deploymentFrom(view *viewerV1beta1.Viewer) (*appsv1.Deployment, error) {
	name := view.Name + "-deployment"
	dpl := &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: view.Namespace,
		},
		Spec: appsv1.DeploymentSpec{
			Selector: &metav1.LabelSelector{
				MatchLabels: map[string]string{
					"deployment": name,
					"app":        "viewer",
					"viewer":     view.Name,
				},
			},
			Template: view.Spec.PodTemplateSpec,
		},
	}

	// Add label so we can select this deployment with a service.
	if dpl.Spec.Template.ObjectMeta.Labels == nil {
		dpl.Spec.Template.ObjectMeta.Labels = make(map[string]string)
	}
	dpl.Spec.Template.ObjectMeta.Labels["deployment"] = name
	dpl.Spec.Template.ObjectMeta.Labels["app"] = "viewer"
	dpl.Spec.Template.ObjectMeta.Labels["viewer"] = view.Name

	return dpl, nil
}

func (t *FlexyVis) setPodSpecForFlexyVis(view *viewerV1beta1.Viewer, s *corev1.PodSpec, flexyVisParams map[string]interface{}) {
	if len(s.Containers) == 0 {
		s.Containers = append(s.Containers, corev1.Container{})
	}

	var gitSource string = "no"
	var entryPoint string = "no"

	if val, ok := flexyVisParams["source"]; ok {
		gitSource = fmt.Sprintf("%v", val)
		delete(flexyVisParams, "source")
	}
	if val, ok := flexyVisParams["entry_point"]; ok {
		entryPoint = fmt.Sprintf("%v", val)
		delete(flexyVisParams, "entry_point")
	}

	c := &s.Containers[0]
	c.Name = view.Name + "-pod"
	c.Image = flexyVisDefaultImage
	c.Args = []string{
		"streamlit",
		"run",
		entryPoint,
		"--",
	}
	for k, v := range flexyVisParams {
		c.Args = append(c.Args, fmt.Sprintf("--%s", k))
		c.Args = append(c.Args, fmt.Sprintf("%s", v))
	}

	c.Ports = []corev1.ContainerPort{
		corev1.ContainerPort{ContainerPort: flexyVisTargetPort},
	}

	c.Env = []corev1.EnvVar{
		corev1.EnvVar{Name: "GIT_PROJECT_URL", Value: gitSource},
		corev1.EnvVar{Name: "GIT_SECRET", Value: gitSecret},
		corev1.EnvVar{Name: "ENTRY_POINT", Value: entryPoint},
	}
}

const mappingTplFlexyVis = `
---
apiVersion: ambassador/v0
kind: Mapping
name: viewer-mapping-%s
prefix: %s
rewrite: /
service: %s`

func (t *FlexyVis) serviceFrom(v *viewerV1beta1.Viewer, deploymentName string) *corev1.Service {
	name := v.Name + "-service"
	path := fmt.Sprintf("/%s/%s/", v.Spec.Type, v.Name)
	mapping := fmt.Sprintf(mappingTplFlexyVis, v.Name, path, name)

	return &corev1.Service{
		ObjectMeta: metav1.ObjectMeta{
			Name:        name,
			Namespace:   v.Namespace,
			Annotations: map[string]string{"getambassador.io/config": mapping},
			Labels: map[string]string{
				"app":    "viewer",
				"viewer": v.Name,
			},
		},
		Spec: corev1.ServiceSpec{
			Selector: map[string]string{
				"deployment": deploymentName,
				"app":        "viewer",
				"viewer":     v.Name,
			},
			Ports: []corev1.ServicePort{
				corev1.ServicePort{
					Name:       "http",
					Protocol:   corev1.ProtocolTCP,
					Port:       80,
					TargetPort: intstr.IntOrString{IntVal: flexyVisTargetPort}},
			},
		},
	}
}
