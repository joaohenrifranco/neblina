# Neblina

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vue.js](https://img.shields.io/badge/Vue.js-35495E?style=flat&logo=vue.js&logoColor=4FC08D)](https://vuejs.org/)
[![WebAssembly](https://img.shields.io/badge/WebAssembly-654FF0?style=flat&logo=webassembly&logoColor=white)](https://webassembly.org/)
[![rclone](https://img.shields.io/badge/rclone-FF6B35?style=flat&logo=rclone&logoColor=white)](https://rclone.org/)


_Neblina_ is a client-side web application that adds transparent end-to-end encryption to cloud storage, ensuring your files remain private even from the provider.

Built on **[rclone](https://rclone.org/)'s proven crypt backend**, Neblina provides a web interface for existing rclone users or new users wanting encrypted cloud storage. Currently, only Google Drive is supported.

> 🏗️ Neblina is currently under active development. It has not undergone extensive security auditing. See [roadmap](#%EF%B8%8F-roadmap) for upcoming features.

![image](public/screenshot.png)

## ✨ Features

- **Browser-based**: View and upload files just like in Google Drive - no installation required
- **Battle-tested encryption**: Uses rclone's original code compiled to WebAssembly - no reimplementation of encryption layer
- **Rclone compatibility**: Works seamlessly with existing rclone crypt remotes (some options are still in progress)
- **Zero-trust archtecture**: All operations execute in your browser, no requests to server after initial load - client-side everything
- **Secure OAuth**: Google Drive integration with short lived OAuth tokens


## 🚀 Quick Start

### Option 1: Use Public Instance

**Try Neblina at [neblina.cloud](https://neblina.cloud)**

No setup required! Uses our public Google Cloud app for OAuth authentication. Your encryption password and files never leave your browser.

### Option 2: Self-Hosting

#### Prerequisites

- **Node.js** (v20 or higher)
- **Go** (v1.21 or higher)
- **npm** or **yarn**

#### Quick Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/neblina.git
   cd neblina
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build the application**:
   ```bash
   npm run build
   ```

4. **Serve the built files**:
   ```bash
   npm run preview
   # or use any static file server
   npx serve dist/
   ```

#### Google OAuth Setup (Required)

To enable Google Drive integration, you need to create your own Google Cloud project:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the **Google Drive API**
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client IDs**
5. Set **Application type** to "Web application"
6. Add your domain to **Authorized JavaScript origins** (e.g., `https://yourdomain.com`)
7. Update the Google Client ID in your deployment

#### Deployment Options

**Static Hosting** (Recommended):
- Deploy the `dist/` folder to any static hosting service
- Examples: Netlify, Vercel, GitHub Pages, CloudFlare Pages

**Docker** (see below for Docker setup)


## 📖 Usage
> ⚠️ **Important**: Google will show an "unverified app" warning because Neblina is an open source project without resources for verification process. This is normal and safe to proceed with.

### For New Users

1. **Add Account**: Click "Add Account" and authenticate with Google Drive
2. **Create a Vault**:
   - Choose a descriptive vault name
   - Click "Choose Vault Folder" to select an **empty** folder in your Google Drive
   - Set a strong encryption password
3. **Start uploading** - files are automatically encrypted before reaching Google Drive

### For Existing rclone Users

1. **Find your password**: `rclone obscure --reveal your-obscured-password`
2. **Add your Google Drive account**
3. **Create a vault** with that password and the same folder path as your existing crypt remote

## 🔧 How It Works

```mermaid
sequenceDiagram
   participant U as User
   participant W as WebApp
   participant G as Google Drive

   U->>W: Input password
   Note right of W: Password saved in memory for session

   U->>W: Upload file
   W->>W: Encrypt file + filename locally
   W->>G: Upload encrypted data

   U->>W: Browse files
   W->>G: Fetch encrypted filenames
   G-->>W: Return encrypted data
   W->>W: Decrypt filenames locally
   W-->>U: Display plain text names

   U->>W: Download file
   W->>G: Fetch encrypted file
   G-->>W: Return encrypted data
   W->>W: Decrypt file locally
   W-->>U: Provide decrypted file
```

## 🛠️ Development

### Local Development Setup

1. **Clone and install**:
   ```bash
   git clone https://github.com/your-username/neblina.git
   cd neblina
   npm install
   ```

2. **Start development server**:
   ```bash
   npm run dev
   ```
   Opens at `http://localhost:3001`

### Build Process

Neblina consists of two main components:

1. **Go WebAssembly module** (rclone crypt functionality)
2. **Vue.js frontend** (web interface)

#### Manual Build Steps

```bash
# Build Go WASM module
npm run build:go

# Build Vue.js frontend
npm run build:vue

# Or build everything
npm run build
```

### Docker Development

```bash
# Build and run with Docker
docker build -t neblina .
docker run -p 3000:80 neblina

# Or use docker-compose
docker-compose up --build
```

## 🗺️ Roadmap

- [ ] Support for rclone's password2 (custom salt)
- [ ] Enable move operations
- [ ] Improve file grid UI
- [ ] Mobile responsive design
- [ ] Global vault search
- [ ] Password manager for vault configs
- [ ] Export/import rclone configs
- [ ] Enable using custom clients on neblina.cloud
- [ ] Disable local storage option
- [ ] Fire button

## 📚 Related Work

- [rclone Crypt Documentation](https://rclone.org/crypt/) - Underlying encryption implementation
- [WebAssembly Security](https://webassembly.org/docs/security/) - WASM security model

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
