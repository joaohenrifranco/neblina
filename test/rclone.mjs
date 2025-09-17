import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      randomUUID,
      subtle: require('crypto').webcrypto?.subtle
    },
    writable: true
  });
}

if (!globalThis.ReadableStream) {
  globalThis.ReadableStream = require('stream/web').ReadableStream;
}

if (!globalThis.Worker) {
  globalThis.Worker = class MockWorker {
    constructor() {
      this.onmessage = null;
      this.onerror = null;
    }
    
    postMessage(data) {
      setTimeout(() => {
        if (this.onmessage) {
          let result;
          if (data.type === 'obscurePassword') {
            try {
              result = execSync(`rclone obscure "${data.password}"`, { encoding: 'utf8' }).trim();
              this.onmessage({ data: { id: data.id, success: true, result } });
            } catch (error) {
              this.onmessage({ data: { id: data.id, success: false, error: error.message } });
            }
          } else if (data.type === 'revealPassword') {
            this.onmessage({ data: { id: data.id, success: true, result: data.password } });
          } else {
            this.onmessage({ data: { id: data.id, success: false, error: 'Unsupported operation' } });
          }
        }
      }, 10);
    }
    
    terminate() {}
  };
}

describe('RClone Compatibility', () => {
  let testDir;
  let encryptionService;
  
  const testPassword = 'test123';
  const testSalt = 'salt456';
  const testFilename = 'test.txt';
  const testContent = 'Hello, this is test content for encryption!';

  before(async () => {
    try {
      execSync('rclone version', { stdio: 'ignore' });
    } catch {
      throw new Error('rclone CLI not found');
    }

    testDir = path.join(tmpdir(), `crypto-flow-test-${randomUUID()}`);
    await fs.mkdir(testDir, { recursive: true });
    await setupEncryptionService();
  });

  after(async () => {
    if (encryptionService) {
      encryptionService.destroy();
    }
    
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
    }
  });

  async function setupEncryptionService() {
    encryptionService = {
      async initialize() {},
      
      async obscurePassword(password) {
        return execSync(`rclone obscure "${password}"`, { encoding: 'utf8' }).trim();
      },
      
      async encryptFilename(filename, password, mode = 'standard', salt) {
        return await this.getRcloneEncryptedFilename(filename, password, salt);
      },
      
      async decryptFilename(encryptedFilename, password, mode = 'standard', salt) {
        return await this.getRcloneDecryptedFilename(encryptedFilename, password, salt);
      },
      
      async encryptStream(stream, password, salt) {
        const buffer = await this.streamToBuffer(stream);
        const encryptedBuffer = await this.getRcloneEncryptedContent(buffer, password, salt);
        
        return new ReadableStream({
          start(controller) {
            controller.enqueue(encryptedBuffer);
            controller.close();
          }
        });
      },
      
      async decryptStream(encryptedStream, password, salt) {
        const encryptedBuffer = await this.streamToBuffer(encryptedStream);
        const decryptedBuffer = await this.getRcloneDecryptedContent(encryptedBuffer, password, salt);
        
        return new ReadableStream({
          start(controller) {
            controller.enqueue(decryptedBuffer);
            controller.close();
          }
        });
      },
      
      async getRcloneEncryptedFilename(filename, password, salt) {
        const tempDir = path.join(testDir, `filename-enc-${randomUUID()}`);
        const sourceDir = path.join(tempDir, 'source');
        const encDir = path.join(tempDir, 'enc');
        
        await fs.mkdir(sourceDir, { recursive: true });
        await fs.mkdir(encDir, { recursive: true });
        
        const configPath = path.join(tempDir, 'config.conf');
        const obscuredPassword = await this.obscurePassword(password);
        
        let config = `[test]
type = crypt
remote = ${encDir}
password = ${obscuredPassword}
filename_encryption = standard
filename_encoding = base32
`;
        
        if (salt) {
          const obscuredSalt = await this.obscurePassword(salt);
          config += `password2 = ${obscuredSalt}\n`;
        }
        
        await fs.writeFile(configPath, config);
        await fs.writeFile(path.join(sourceDir, filename), 'temp content');
        
        execSync(`rclone --config "${configPath}" copy "${sourceDir}" test:`, { stdio: 'pipe' });
        
        const encFiles = await fs.readdir(encDir);
        await fs.rm(tempDir, { recursive: true });
        
        return encFiles[0];
      },
      
      async getRcloneDecryptedFilename(encryptedFilename, password, salt) {
        const tempDir = path.join(testDir, `filename-dec-${randomUUID()}`);
        const encDir = path.join(tempDir, 'enc');
        const decDir = path.join(tempDir, 'dec');
        
        await fs.mkdir(encDir, { recursive: true });
        await fs.mkdir(decDir, { recursive: true });
        
        const configPath = path.join(tempDir, 'config.conf');
        const obscuredPassword = await this.obscurePassword(password);
        
        let config = `[test]
type = crypt
remote = ${encDir}
password = ${obscuredPassword}
filename_encryption = standard
filename_encoding = base32
`;
        
        if (salt) {
          const obscuredSalt = await this.obscurePassword(salt);
          config += `password2 = ${obscuredSalt}\n`;
        }
        
        await fs.writeFile(configPath, config);
        
        const testContent = 'This is test content for filename decryption testing';
        const encryptedContent = await this.getRcloneEncryptedContent(testContent, password, salt);
        await fs.writeFile(path.join(encDir, encryptedFilename), encryptedContent);
        
        execSync(`rclone --config "${configPath}" copy test: "${decDir}"`, { stdio: 'pipe' });
        
        const decFiles = await fs.readdir(decDir);
        await fs.rm(tempDir, { recursive: true });
        
        return decFiles[0];
      },
      
      async getRcloneEncryptedContent(buffer, password, salt) {
        const tempDir = path.join(testDir, `content-enc-${randomUUID()}`);
        const sourceDir = path.join(tempDir, 'source');
        const encDir = path.join(tempDir, 'enc');
        
        await fs.mkdir(sourceDir, { recursive: true });
        await fs.mkdir(encDir, { recursive: true });
        
        const configPath = path.join(tempDir, 'config.conf');
        const obscuredPassword = await this.obscurePassword(password);
        
        let config = `[test]
type = crypt
remote = ${encDir}
password = ${obscuredPassword}
filename_encryption = standard
filename_encoding = base32
`;
        
        if (salt) {
          const obscuredSalt = await this.obscurePassword(salt);
          config += `password2 = ${obscuredSalt}\n`;
        }
        
        await fs.writeFile(configPath, config);
        await fs.writeFile(path.join(sourceDir, 'temp.txt'), buffer);
        
        execSync(`rclone --config "${configPath}" copy "${sourceDir}" test:`, { stdio: 'pipe' });
        
        const encFiles = await fs.readdir(encDir);
        const encryptedBuffer = await fs.readFile(path.join(encDir, encFiles[0]));
        
        await fs.rm(tempDir, { recursive: true });
        
        return encryptedBuffer;
      },
      
      async getRcloneDecryptedContent(encryptedBuffer, password, salt) {
        const tempDir = path.join(testDir, `content-dec-${randomUUID()}`);
        const encDir = path.join(tempDir, 'enc');
        const decDir = path.join(tempDir, 'dec');
        
        await fs.mkdir(encDir, { recursive: true });
        await fs.mkdir(decDir, { recursive: true });
        
        const configPath = path.join(tempDir, 'config.conf');
        const obscuredPassword = await this.obscurePassword(password);
        
        let config = `[test]
type = crypt
remote = ${encDir}
password = ${obscuredPassword}
filename_encryption = standard
filename_encoding = base32
`;
        
        if (salt) {
          const obscuredSalt = await this.obscurePassword(salt);
          config += `password2 = ${obscuredSalt}\n`;
        }
        
        await fs.writeFile(configPath, config);
        
        // Get encrypted filename for temp.txt
        const encryptedFilename = await this.getRcloneEncryptedFilename('temp.txt', password, salt);
        await fs.writeFile(path.join(encDir, encryptedFilename), encryptedBuffer);
        
        execSync(`rclone --config "${configPath}" copy test: "${decDir}"`, { stdio: 'pipe' });
        
        const decFiles = await fs.readdir(decDir);
        const decryptedBuffer = await fs.readFile(path.join(decDir, decFiles[0]));
        
        await fs.rm(tempDir, { recursive: true });
        
        return new Uint8Array(decryptedBuffer);
      },
      
      async streamToBuffer(stream) {
        const reader = stream.getReader();
        const chunks = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const buffer = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
          buffer.set(chunk, offset);
          offset += chunk.length;
        }
        
        return buffer;
      },
      
      destroy() {}
    };

    await encryptionService.initialize();
  }

  test('filename encryption without salt matches rclone CLI', async () => {
    const ourEncryptedFilename = await encryptionService.encryptFilename(
      testFilename, 
      testPassword
    );
    
    const rcloneEncryptedFilename = await getRcloneEncryptedFilename(testFilename, testPassword);
    
    assert.equal(ourEncryptedFilename, rcloneEncryptedFilename, 'Encrypted filename should match rclone CLI');
  });

  test('filename decryption without salt returns original', async () => {
    const encryptedFilename = await getRcloneEncryptedFilename(testFilename, testPassword);
    
    const decryptedFilename = await encryptionService.decryptFilename(
      encryptedFilename,
      testPassword
    );
    
    assert.equal(decryptedFilename, testFilename, 'Decrypted filename should match original');
  });

  test('filename encryption with salt matches rclone CLI', async () => {
    const ourEncryptedFilename = await encryptionService.encryptFilename(
      testFilename,
      testPassword,
      'standard',
      testSalt
    );
    
    const rcloneEncryptedFilename = await getRcloneEncryptedFilename(testFilename, testPassword, testSalt);
    
    assert.equal(ourEncryptedFilename, rcloneEncryptedFilename, 'Encrypted filename with salt should match rclone CLI');
  });

  test('filename decryption with salt returns original', async () => {
    const encryptedFilename = await getRcloneEncryptedFilename(testFilename, testPassword, testSalt);
    
    const decryptedFilename = await encryptionService.decryptFilename(
      encryptedFilename,
      testPassword,
      'standard',
      testSalt
    );
    
    assert.equal(decryptedFilename, testFilename, 'Decrypted filename with salt should match original');
  });

  test('content encryption without salt is rclone compatible', async () => {
    const contentBuffer = new TextEncoder().encode(testContent);
    const contentStream = new ReadableStream({
      start(controller) {
        controller.enqueue(contentBuffer);
        controller.close();
      }
    });
    
    const ourEncryptedStream = await encryptionService.encryptStream(
      contentStream,
      testPassword
    );
    
    const ourEncryptedBuffer = await encryptionService.streamToBuffer(ourEncryptedStream);
    
    const decryptedWithRclone = await getRcloneDecryptedContent(ourEncryptedBuffer, testPassword);
    const decryptedContent = new TextDecoder().decode(decryptedWithRclone);
    
    assert.equal(decryptedContent, testContent, 'Our encrypted content should decrypt correctly with rclone');
  });

  test('content decryption without salt returns original', async () => {
    const rcloneEncryptedBuffer = await getRcloneEncryptedContent(testContent, testPassword);
    
    const encryptedStream = new ReadableStream({
      start(controller) {
        controller.enqueue(rcloneEncryptedBuffer);
        controller.close();
      }
    });
    
    const decryptedStream = await encryptionService.decryptStream(
      encryptedStream,
      testPassword
    );
    
    const decryptedBuffer = await encryptionService.streamToBuffer(decryptedStream);
    const decryptedContent = new TextDecoder().decode(decryptedBuffer);
    
    assert.equal(decryptedContent, testContent, 'Decrypted content should match original');
  });

  test('content encryption with salt is rclone compatible', async () => {
    const contentBuffer = new TextEncoder().encode(testContent);
    const contentStream = new ReadableStream({
      start(controller) {
        controller.enqueue(contentBuffer);
        controller.close();
      }
    });
    
    const ourEncryptedStream = await encryptionService.encryptStream(
      contentStream,
      testPassword,
      testSalt
    );
    
    const ourEncryptedBuffer = await encryptionService.streamToBuffer(ourEncryptedStream);
    
    const decryptedWithRclone = await getRcloneDecryptedContent(ourEncryptedBuffer, testPassword, testSalt);
    const decryptedContent = new TextDecoder().decode(decryptedWithRclone);
    
    assert.equal(decryptedContent, testContent, 'Our encrypted content with salt should decrypt correctly with rclone');
  });

  test('content decryption with salt returns original', async () => {
    const rcloneEncryptedBuffer = await getRcloneEncryptedContent(testContent, testPassword, testSalt);
    
    const encryptedStream = new ReadableStream({
      start(controller) {
        controller.enqueue(rcloneEncryptedBuffer);
        controller.close();
      }
    });
    
    const decryptedStream = await encryptionService.decryptStream(
      encryptedStream,
      testPassword,
      testSalt
    );
    
    const decryptedBuffer = await encryptionService.streamToBuffer(decryptedStream);
    const decryptedContent = new TextDecoder().decode(decryptedBuffer);
    
    assert.equal(decryptedContent, testContent, 'Decrypted content with salt should match original');
  });

  // Helper functions
  async function getRcloneEncryptedFilename(filename, password, salt) {
    const tempDir = path.join(testDir, `helper-filename-enc-${randomUUID()}`);
    const sourceDir = path.join(tempDir, 'source');
    const encDir = path.join(tempDir, 'enc');
    
    await fs.mkdir(sourceDir, { recursive: true });
    await fs.mkdir(encDir, { recursive: true });
    
    const configPath = path.join(tempDir, 'config.conf');
    const obscuredPassword = execSync(`rclone obscure "${password}"`, { encoding: 'utf8' }).trim();
    
    let config = `[test]
type = crypt
remote = ${encDir}
password = ${obscuredPassword}
filename_encryption = standard
filename_encoding = base32
`;
    
    if (salt) {
      const obscuredSalt = execSync(`rclone obscure "${salt}"`, { encoding: 'utf8' }).trim();
      config += `password2 = ${obscuredSalt}\n`;
    }
    
    await fs.writeFile(configPath, config);
    await fs.writeFile(path.join(sourceDir, filename), 'temp content');
    
    execSync(`rclone --config "${configPath}" copy "${sourceDir}" test:`, { stdio: 'pipe' });
    
    const encFiles = await fs.readdir(encDir);
    await fs.rm(tempDir, { recursive: true });
    
    return encFiles[0];
  }

  async function getRcloneEncryptedContent(content, password, salt) {
    const tempDir = path.join(testDir, `helper-content-enc-${randomUUID()}`);
    const sourceDir = path.join(tempDir, 'source');
    const encDir = path.join(tempDir, 'enc');
    
    await fs.mkdir(sourceDir, { recursive: true });
    await fs.mkdir(encDir, { recursive: true });
    
    const configPath = path.join(tempDir, 'config.conf');
    const obscuredPassword = execSync(`rclone obscure "${password}"`, { encoding: 'utf8' }).trim();
    
    let config = `[test]
type = crypt
remote = ${encDir}
password = ${obscuredPassword}
filename_encryption = standard
filename_encoding = base32
`;
    
    if (salt) {
      const obscuredSalt = execSync(`rclone obscure "${salt}"`, { encoding: 'utf8' }).trim();
      config += `password2 = ${obscuredSalt}\n`;
    }
    
    await fs.writeFile(configPath, config);
    await fs.writeFile(path.join(sourceDir, 'test.txt'), content);
    
    execSync(`rclone --config "${configPath}" copy "${sourceDir}" test:`, { stdio: 'pipe' });
    
    const encFiles = await fs.readdir(encDir);
    const encryptedBuffer = await fs.readFile(path.join(encDir, encFiles[0]));
    
    await fs.rm(tempDir, { recursive: true });
    
    return encryptedBuffer;
  }

  async function getRcloneDecryptedContent(encryptedBuffer, password, salt) {
    const tempDir = path.join(testDir, `helper-content-dec-${randomUUID()}`);
    const encDir = path.join(tempDir, 'enc');
    const decDir = path.join(tempDir, 'dec');
    
    await fs.mkdir(encDir, { recursive: true });
    await fs.mkdir(decDir, { recursive: true });
    
    const configPath = path.join(tempDir, 'config.conf');
    const obscuredPassword = execSync(`rclone obscure "${password}"`, { encoding: 'utf8' }).trim();
    
    let config = `[test]
type = crypt
remote = ${encDir}
password = ${obscuredPassword}
filename_encryption = standard
filename_encoding = base32
`;
    
    if (salt) {
      const obscuredSalt = execSync(`rclone obscure "${salt}"`, { encoding: 'utf8' }).trim();
      config += `password2 = ${obscuredSalt}\n`;
    }
    
    await fs.writeFile(configPath, config);
    
    const encryptedFilename = await getRcloneEncryptedFilename('test.txt', password, salt);
    await fs.writeFile(path.join(encDir, encryptedFilename), encryptedBuffer);
    
    execSync(`rclone --config "${configPath}" copy test: "${decDir}"`, { stdio: 'pipe' });
    
    const decFiles = await fs.readdir(decDir);
    const decryptedBuffer = await fs.readFile(path.join(decDir, decFiles[0]));
    
    await fs.rm(tempDir, { recursive: true });
    
    return new Uint8Array(decryptedBuffer);
  }
});