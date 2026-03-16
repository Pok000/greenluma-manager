# GreenLuma Manager

A Windows desktop manager for GreenLuma built with Tauri, React, and Tailwind CSS. 
Track games, manage multiple profiles, search the Steam store, and easily generate your AppList configurations without manually editing text files.

## Features

- Live Steam Store search integration
- Visual game library with cover art tracking
- Multiple profile management (save specific groups of games)
- Automated GreenLuma AppList generation
- One-click GreenLuma enable and disable mechanisms (handles user32.dll)
- Clean, premium dark-mode interface

## Development Setup

Prerequisites:
- Rust (stable)
- Node.js (LTS)
- pnpm

1. Clone the repository
2. Install frontend dependencies:
   ```bash
   pnpm install
   ```
3. Run the Tauri development server:
   ```bash
   pnpm tauri dev
   ```

## Build

To compile a highly optimized Windows executable:

```bash
pnpm tauri build
```
