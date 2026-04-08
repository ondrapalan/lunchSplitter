import sharp from 'sharp'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const svgPath = join(__dirname, '..', 'public', 'logo.svg')
const svgBuffer = readFileSync(svgPath)

const sizes = [
  { name: 'logo-1024.png', size: 1024, dir: 'public' },
  { name: 'icon.png', size: 32, dir: 'src/app' },
  { name: 'apple-icon.png', size: 180, dir: 'src/app' },
]

for (const { name, size, dir } of sizes) {
  const outputPath = join(__dirname, '..', dir, name)
  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(outputPath)
  console.log(`Generated ${dir}/${name} (${size}x${size})`)
}
