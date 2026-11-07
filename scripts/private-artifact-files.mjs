import fs from 'node:fs/promises';
import path from 'node:path';

const PRIVATE_DIRECTORY_MODE = 0o700;
const PRIVATE_FILE_MODE = 0o600;

export async function ensurePrivateDirectory(directoryPath) {
  await fs.mkdir(directoryPath, { recursive: true, mode: PRIVATE_DIRECTORY_MODE });
  await fs.chmod(directoryPath, PRIVATE_DIRECTORY_MODE);
}

export async function writePrivateFile(filePath, data, options = 'utf8') {
  await ensurePrivateDirectory(path.dirname(filePath));
  await fs.writeFile(filePath, data, {
    ...(typeof options === 'string' ? { encoding: options } : options),
    mode: PRIVATE_FILE_MODE,
  });
  await fs.chmod(filePath, PRIVATE_FILE_MODE);
}

export async function copyPrivateFile(sourcePath, outputPath) {
  await ensurePrivateDirectory(path.dirname(outputPath));
  await fs.copyFile(sourcePath, outputPath);
  await fs.chmod(outputPath, PRIVATE_FILE_MODE);
}

export async function restrictPrivateFile(filePath) {
  await fs.chmod(filePath, PRIVATE_FILE_MODE);
}
