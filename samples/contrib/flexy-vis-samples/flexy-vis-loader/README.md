# kf-flexy-vis

Provides entrypoint for extended Kubeflow visualisation that allows to run streamlit projects.

```
docker build -t dmitryb/kf-flexy-vis-loader:latest -f flexy-vis-loader/Dockerfile flexy-vis-loader

docker push dmitryb/kf-flexy-vis-loader:latest

docker run -it --rm \
    -e GIT_PROJECT_URL="https://github.com/DmitryBe/streamlit-samples.git" \
    -e GIT_SECRET="user:token" \
    -p 8501:8501 \
    dmitryb/kf-flexy-vis-loader:latest \
    bash -c "streamlit run ./vis.py -- --logdir=s3://some/data"
```