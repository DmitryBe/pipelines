# kf-flexy-vis

Provides entrypoint for extended Kubeflow visualisation that allows to run streamlit projects.

```
docker build -t dmitryb/kf-flexy-vis-loader:latest -f flexy-vis-loader/Dockerfile flexy-vis-loader

docker push dmitryb/kf-flexy-vis-loader:latest

docker run -it --rm \
    -e GIT_PROJECT_URL="https://gitlab.myteksi.net/dmitry.bezyazychnyy/streamlit-playground.git" \
    -e GIT_SECRET="user:token" \
    -p 8501:8501 \
    dmitryb/kf-flexy-vis:latest \
    bash -c "streamlit run app/vis.py -- --logdir=s3://some/data"
```