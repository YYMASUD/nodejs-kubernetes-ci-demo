# Node.js Frontend Running on Kubernetes

A beginner-friendly Node.js + Express frontend, containerized with Docker and deployed to Kubernetes. The project is automatically tested in CI with GitHub Actions, which spins up a temporary [Kind](https://kind.sigs.k8s.io/) (Kubernetes-in-Docker) cluster on every push, deploys the app into it, and verifies that both the web page and the `/health` endpoint respond correctly — all without publishing anything to a container registry.

## Prerequisites

Make sure you have these tools installed before starting:

| Tool | Minimum version | How to check |
| --- | --- | --- |
| Node.js | 22+ | `node -v` |
| npm | ships with Node.js | `npm -v` |
| Docker Desktop (or a compatible Docker engine) | any recent version | `docker -v` |
| kubectl | any recent version | `kubectl version --client` |
| Kind | any recent version | `kind version` |

Quick check from your terminal:

```bash
node -v
docker -v
kubectl version --client
kind version
```

If any of these commands fails, install the missing tool first — see the official docs for [Node.js](https://nodejs.org/), [Docker Desktop](https://www.docker.com/products/docker-desktop/), [kubectl](https://kubernetes.io/docs/tasks/tools/), and [Kind](https://kind.sigs.k8s.io/docs/user/quick-start/).

## Getting Started / Local Run

Run the app directly with Node.js — the fastest way to see it working:

```bash
npm install
npm start
```

Then open <http://localhost:3000> in your browser. You should see the demo page.

The server also exposes a health check endpoint at <http://localhost:3000/health>, which always returns:

```json
{"status":"ok"}
```

Kubernetes and the CI pipeline use this endpoint to confirm the app is alive.

## Docker Build and Run

Package the app as a container image and run it exactly the way Kubernetes will:

```bash
docker build -t nodejs-kubernetes-ci-demo:latest .
```

Then start a container from that image, mapping port 3000 on your machine to port 3000 in the container:

```bash
docker run --rm -p 3000:3000 nodejs-kubernetes-ci-demo:latest
```

Open <http://localhost:3000> — same app, now inside a container. Press `Ctrl+C` in the terminal to stop it (the `--rm` flag removes the stopped container automatically).

## Deploy to a Local Kubernetes Cluster with Kind

Now for the fun part: run the app inside a real Kubernetes cluster on your own machine.

1. Create a local cluster named `nodejs-demo`:

```bash
kind create cluster --name nodejs-demo
```

2. Load the Docker image you built earlier into the cluster. Kind can't see images from your local Docker engine by default, so this step copies the image into the cluster's node:

```bash
kind load docker-image nodejs-kubernetes-ci-demo:latest --name nodejs-demo
```

3. Apply the Kubernetes manifests (a namespace, a Deployment with 2 replicas, and a ClusterIP Service):

```bash
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
```

4. Tell the Deployment to use the image you just loaded (overriding the default image reference from the manifest):

```bash
kubectl -n node-demo set image deployment/node-frontend node-frontend=nodejs-kubernetes-ci-demo:latest
```

5. Wait until the rollout finishes and both Pods are healthy:

```bash
kubectl -n node-demo rollout status deployment/node-frontend
```

You can watch the Pods come up at any time with `kubectl -n node-demo get pods`.

## Port-Forward and Test

The Service is `ClusterIP`-type, meaning it's only reachable from inside the cluster. To reach it from your browser, forward a local port to the Service:

```bash
kubectl -n node-demo port-forward svc/node-frontend 8080:80
```

Keep that terminal running, then open:

- <http://localhost:8080> — the frontend page
- <http://localhost:8080/health> — the health endpoint, returning `{"status":"ok"}`

Stop the port-forward with `Ctrl+C` when you're done.

## Tests

Run the test suite with Node's built-in test runner:

```bash
npm test
```

The tests don't use mocks — they start the **real server** on a separate port (`3123`), wait for it to become ready, and then check that:

- `GET /health` returns HTTP `200` with the body `{"status":"ok"}`
- `GET /` returns the landing page containing the heading "Node.js Frontend Running on Kubernetes"

The spawned server is shut down automatically when the tests finish.

## CI (GitHub Actions)

The workflow in `.github/workflows/ci.yml` runs the entire pipeline automatically:

- **Name:** `CI`
- **Triggers:** every push to `main` and every pull request targeting `main`
- **Permissions:** least-privilege — it uses only the built-in `GITHUB_TOKEN` with `contents: read` (no registry credentials, no secrets)

The job validates the full stack end-to-end:

1. Installs dependencies reproducibly with `npm ci`, then runs `npm test`
2. Builds the Docker image locally (tagged `nodejs-kubernetes-ci-demo:test`)
3. Creates a temporary Kind cluster via `helm/kind-action@v1` with cluster name `nodejs-demo`
4. Loads the locally built image into the Kind cluster
5. Applies the Kubernetes manifests and overrides the image to the locally built test tag
6. Waits for the rollout to complete
7. Starts a port-forward, then verifies that `GET /` contains the page heading and that `GET /health` returns HTTP `200` with `"status":"ok"`
8. If anything fails, a diagnostics step prints the cluster's pods, services, deployments, events, and pod logs to make debugging easy

No image is ever published to any container registry — everything is built, deployed, and verified locally within the CI runner.

## Repository Structure

```text
.
├── server.js                    # Tiny Express server (static files + /health)
├── public/
│   └── index.html               # The frontend page
├── test/
│   └── health.test.js           # Tests using Node's built-in test runner
├── Dockerfile                   # Production container image
├── .dockerignore                # Keeps the image small and clean
├── k8s/
│   ├── deployment.yaml          # Namespace + Deployment (2 replicas, probes)
│   ├── service.yaml             # ClusterIP Service on port 80 → 3000
│   └── kustomization.yaml       # Kustomize overlay for the manifests
├── .github/
│   └── workflows/
│       └── ci.yml               # GitHub Actions CI pipeline
├── package.json                 # Scripts and dependencies
├── package-lock.json            # Locked dependency versions (used by npm ci)
├── .gitignore                   # Files Git should ignore
└── README.md                    # This file
```

## Cleanup

When you're finished experimenting, tear down the local cluster:

```bash
kind delete cluster --name nodejs-demo
```

If you still have a local container running from the Docker section, stop it with `Ctrl+C` (or remove it with `docker stop` / `docker rm`).

## License

This project is licensed under the [MIT](https://opensource.org/licenses/MIT) license.

