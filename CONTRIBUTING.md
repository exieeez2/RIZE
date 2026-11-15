# Contributing to RIZE

We welcome contributions to RIZE! Please review these guidelines before submitting a merge request or opening an issue.

## Development Setup

1. **Clone the repository:**
   ```bash
   git clone <your-gitlab-repo-url>
   cd rize
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```
   *Note: During `postinstall`, `scripts/download-ytdlp.js` will download the necessary local helper binaries to `bin/`.*

3. **Configure Environment (Optional):**
   Copy the example Firebase configuration if you plan on testing cloud accounts and theme workshop features:
   ```bash
   cp firebase-config.example.json firebase-config.json
   ```
   Fill in your Firebase project credentials. If omitted, RIZE runs gracefully in local offline mode.

4. **Start Development Server:**
   ```bash
   npm run start:electron
   # or
   npm run start:tauri
   ```

5. **Run Tests & Linting:**
   ```bash
   npm test
   npm run lint
   ```

## Merge Request Guidelines

- Ensure all automated unit tests pass before submitting.
- Never commit secrets, tokens, API keys, or private keystores.
- Keep commits clear, concise, and focused.
