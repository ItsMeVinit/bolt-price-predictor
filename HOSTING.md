# Hosting and deployment options

This repository is a Vite + React app that builds into a static `dist/` folder. Below are several hosting options and step-by-step instructions you can use to publish the site.

1) Quick check (locally)

 - Build: `npm run build`
 - Preview: `npm run preview` (serves the built files at a local port, e.g. http://localhost:4173/)

2) Docker (run anywhere supporting containers)

 - Build the image locally:
   ```powershell
   docker build -t bolt-price-predictor .
   ```
 - Run the container (map port 80):
   ```powershell
   docker run --rm -p 8080:80 bolt-price-predictor
   ```
 - Open: http://localhost:8080/

3) GitHub Pages (CI -> gh-pages branch)

 - A GitHub Actions workflow has been added at `.github/workflows/deploy-gh-pages.yml`. On push to `main` the action will:
   - install dependencies
   - run `npm run build`
   - push contents of `dist/` to the `gh-pages` branch
 - GitHub Pages will serve the site from the `gh-pages` branch. If your repo is private or you prefer `main` branch pages, update the workflow accordingly.

Note about Vite base path

 - When GitHub Pages serves your site from https://<owner>.github.io/<repo>/ you must build the app with Vite's `base` set to `/<repo>/` so static assets are loaded from the correct path. The `deploy-gh-pages` workflow in this repo automatically sets the build base to `/${{ github.event.repository.name }}/` at build time.
 - If you host the site at a custom domain or at a user/org root site (e.g., `https://<owner>.github.io/`), update the workflow's Build step to use `--base '/'` or remove the `--base` override and set `base` in `vite.config.ts`.

4) Vercel / Netlify (recommended for easiest continuous deploy)

 - Connect your Git provider (GitHub/GitLab/Bitbucket).
 - Set the framework to Vite, build command: `npm run build`, publish directory: `dist`.
 - These platforms will automatically build on each push and provide TLS, CDN and previews.

5) Supabase Edge Functions (server-side code)

 - Frontend hosting is static — but this project includes Supabase functions under `supabase/functions/`.
 - To deploy those serverless functions to Supabase you'll need the Supabase CLI and an access token.
   Example steps:
   ```powershell
   npm install -g supabase
   supabase login  # provide access token
   cd supabase/functions/predict-stock
   supabase functions deploy predict-stock --project-ref <PROJECT_REF>
   ```
 - For CI deploy, add `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_REF` as repo secrets and create a workflow that installs the CLI and runs `supabase functions deploy`.

## Docker image publishing (GHCR / Docker Hub)

There's a GitHub Actions workflow at `.github/workflows/docker-publish.yml` that will:

- Install dependencies and run `npm run build` to produce `dist/`.
- Build a multi-platform Docker image (using the `Dockerfile`) and push the image to GitHub Container Registry (GHCR).
- Optionally push the same image to Docker Hub if `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` are provided as secrets.

Required or recommended GitHub repository secrets:

- `GITHUB_TOKEN` — automatically provided by GitHub Actions; used to authenticate to GHCR for the workflow. No manual setup required.
- `DOCKERHUB_USERNAME` — (optional) your Docker Hub username. Add this if you want images pushed to Docker Hub.
- `DOCKERHUB_TOKEN` — (optional) a Docker Hub access token (not your raw password). Create a token in Docker Hub and add it as this secret.

Image naming used by the workflow:

- GHCR: `ghcr.io/<github-owner>/<repo>:latest` and `ghcr.io/<github-owner>/<repo>:<sha>`
- Docker Hub (optional): `docker.io/<DOCKERHUB_USERNAME>/<repo>:latest` and `docker.io/<DOCKERHUB_USERNAME>/<repo>:<sha>`

How to use the Docker workflow manually

 - From the Actions tab in GitHub, you can run the `Build and publish Docker image` workflow manually (workflow_dispatch) or push to `main`.
 - Make sure to add `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` if you want the image published to Docker Hub as well.


### Automated deployment via GitHub Actions

I added a workflow at `.github/workflows/deploy-supabase-functions.yml` that will:

- Install the Supabase CLI
- Log in using the `SUPABASE_ACCESS_TOKEN` secret
- Deploy every function found under `supabase/functions/` using the `SUPABASE_PROJECT_REF` secret

Required repository secrets (add these in your GitHub repo Settings → Secrets → Actions):

- `SUPABASE_ACCESS_TOKEN` — a Supabase access token. For CI deploy you should create a service role or personal access token with the necessary permissions to deploy functions. Do not commit this token to source control.
- `SUPABASE_PROJECT_REF` — your Supabase project reference (the short project id shown in the Supabase dashboard URL).

Notes on the workflow:

- The workflow runs on pushes to `main` and can also be triggered manually (workflow_dispatch).
- It uses `supabase functions deploy <name> --project-ref <ref>` to deploy each function folder. If your functions require additional build steps (custom Deno/Node versions or environment variables), we can extend the workflow to set those before deployment.


Notes and next steps

 - The repo contains a `Dockerfile` that serves `dist/` via nginx.
 - There's a GitHub Actions workflow to deploy built files to GitHub Pages; you can enable it by pushing to `main`.
 - If you want, I can add GitHub Actions to automatically build and deploy Supabase functions (requires a Supabase access token secret), or add a workflow for pushing Docker images to a registry (requires credentials).
