# CesiumJS Deep Dive Workshop

Stater code for the CesiumJS Deep Dive Workshop, part of the 2025 Cesium Developer Conference.

This example repo is designed to get a new developer up and running with a base [CesiumJS](https://cesium.com/platform/cesiumjs/) app. It's built using Vite and is based on [`cesium-vite-example`](https://github.com/CesiumGS/cesium-vite-example).

## Requirements

- A [Cesium ion account](https://ion.cesium.com/signup)
- [Visual Studio Code](https://code.visualstudio.com/), or an IDE of choice
- [NodeJS](https://nodejs.org/en), version 20+, with npm
  - We recommend [installing via nvm](https://nodejs.org/en/download) for first-time setup
- Optional: [Git](https://docs.github.com/en/get-started/git-basics/set-up-git#platform-all) to clone from example repo

## Setup

1. Download a copy of the code:

   - If using Git, [**fork this repository** and sync it on your local machine](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/fork-a-repo) at the desired location.
   - Otherwise, [**download the source code**](https://docs.github.com/en/repositories/working-with-files/using-files/downloading-source-code-archives) and unzip to your desired location.

2. In Visual Studio Code, [open the workspace](https://code.visualstudio.com/docs/editing/workspaces/workspaces) by using **File** > **Open Folder...** and selecting the `cesiumjs-workshop` directory from the previous step.
3. Open the terminal by using **Terminal** > **New Terminal**.
4. Run the following commands to setup, build, and run the app:

   ```sh
   npm install # Install project dependencies
   ```

   ```sh
   npm run dev # Build and start the development server
   ```

5. In a browser, navigate to [`http://localhost:5173/`](http://localhost:5173/)

## Developer scripts

This project includes a few tools to support development. Any of the following commands can be run in terminal.

- `npm run eslint`: Find and fix common JavaScript code issues using [ESLint](https://eslint.org/)
- `npm run prettier`: Format all the code to a consistent style using [Prettier](https://prettier.io/)
- `npm run dev`: Start a development server at [`http://localhost:5173/`](http://localhost:5173/) using [Vite](https://vite.dev/)
- `npm run build`: Run an optimized build for production and output to the `dist/` directory
