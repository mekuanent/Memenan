# Contributing to Memenan

Welcome! **Memenan** is an open-source platform for churches and congregations—with first-class support for Ethiopian Orthodox Tewahedo and Gregorian calendars, fasting periods, clergy office hours, and church sacraments/services.

We welcome community contributions via **Pull Requests**! All Pull Requests are reviewed and merged exclusively by the repository maintainer.

---

## 🌟 Easy Ways to Contribute (No Code Required!)

Many of our core church templates live in simple JSON files so anyone in the community can help crowdsource and refine them:

1. **Sacraments & Church Services Templates**
   - File: [`church-app/lib/data/church-services.json`](church-app/lib/data/church-services.json)
   - Add default sacraments/services (such as *Eucharist / Holy Communion*, *Infant Baptism*, *Adult Baptism*, *Confession*, *Holy Matrimony*) or improve the default English (`defaultInstructions`) and Amharic (`defaultInstructions_am`) preparation instructions that churches can select and customize when registering.

2. **Ethiopian Orthodox & Gregorian Holidays**
   - Files:
     - [`church-app/lib/data/ethiopian-holidays.json`](church-app/lib/data/ethiopian-holidays.json)
     - [`church-app/lib/data/gregorian-holidays.json`](church-app/lib/data/gregorian-holidays.json)

3. **Canonical Fasting Periods**
   - File: [`church-app/lib/data/ethiopian-fasts.json`](church-app/lib/data/ethiopian-fasts.json)

4. **Amharic & English UI Translations**
   - File: [`church-app/lib/i18n/translations.ts`](church-app/lib/i18n/translations.ts)

---

## 🔄 How to Submit a Pull Request

1. **Fork** the repository on GitHub.
2. Create a new branch for your changes:
   ```bash
   git checkout -b feat/improve-baptism-instructions
   ```
3. Make your edits and test locally:
   ```bash
   cd church-app
   npm install
   npm run dev
   ```
4. Commit and push to your fork, then open a **Pull Request** against `main`.

---

## 🔒 Maintainer Guide: Restricting PR Merges to Yourself on GitHub

When making this repository public on GitHub, follow these steps once in your GitHub repository settings so anyone can open a PR, **but only you can approve and merge**:

1. Update [`.github/CODEOWNERS`](.github/CODEOWNERS) with your exact GitHub username (e.g., `@your-github-username`).
2. On GitHub, go to **Settings** → **Rules** → **Rulesets** (or **Branches** → **Add branch protection rule** for `main`).
3. Enable the following settings for the `main` branch:
   - ✅ **Require a pull request before merging**
     - ✅ **Require approvals** (`1`)
     - ✅ **Require review from Code Owners** (this enforces `.github/CODEOWNERS`, meaning only you can approve!)
     - ✅ **Dismiss stale pull request approvals when new commits are pushed**
   - ✅ **Require status checks to pass before merging**
     - Select `Validate Data & App` (from `.github/workflows/ci.yml`)
   - ✅ **Block force pushes** & **Restrict deletions**
4. With these rules active on a public GitHub repository, contributors can fork the repo and open Pull Requests, while the **Merge Pull Request** button is strictly locked to your account.
