const express = require('express');
const { execFile } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const rateLimit = require('express-rate-limit');
const multer = require('multer');

const app = express();
const port = process.env.PORT || 3000;

// Limita a ~10 peticiones cada 2 minutos por IP (para evitar abuso)
const limiter = rateLimit({
  windowMs: 2 * 60 * 1000,
  max: 10,
  message: 'Demasiadas peticiones, espera 2 minutos.'
});

app.use(limiter);
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(express.json({ limit: '5mb' }));

// Usa EJS para vistas (o puedes servir HTML estático)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Config multer para manejar archivos grandes si alguien sube .lua
const upload = multer({ dest: 'uploads/', limits: { fileSize: 5 * 1024 * 1024 } });

// Página principal
app.get('/', (req, res) => {
  res.render('index', { result: null, error: null });
});

// Ruta para procesar
app.post('/deob', upload.single('file'), async (req, res) => {
  let code = req.body.code;
  const file = req.file;

  if (file) {
    try {
      code = await fs.readFile(file.path, 'utf-8');
      await fs.unlink(file.path); // borra temp
    } catch (e) {
      return res.render('index', { result: null, error: 'Error al leer archivo' });
    }
  }

  if (!code?.trim()) {
    return res.render('index', { result: null, error: 'Pega código o sube archivo .lua' });
  }

  const inputPath  = path.join(__dirname, '..', 'input_temp.lua');
  const outputPath = path.join(__dirname, '..', 'output_deob.lua');

  try {
    await fs.writeFile(inputPath, code);

    // Comando principal – ajusta flags según necesites (sin --trace por defecto para ir rápido)
    const args = [path.join('src', 'deob', 'cli.lua'), inputPath, '--out', outputPath];

    execFile('lua', args, { cwd: path.join(__dirname, '..'), timeout: 45000 }, async (err, stdout, stderr) => {
      let resultText = '';
      let errorMsg = null;

      if (err) {
        errorMsg = stderr || err.message || 'Error al ejecutar el deobfuscator (timeout o fallo Lua)';
      } else {
        try {
          resultText = await fs.readFile(outputPath, 'utf-8');
        } catch (e) {
          errorMsg = 'Deobfuscator terminó pero no se pudo leer el output';
        }
      }

      // Limpieza
      await Promise.allSettled([
        fs.unlink(inputPath).catch(() => {}),
        fs.unlink(outputPath).catch(() => {})
      ]);

      res.render('index', {
        result: resultText || null,
        error: errorMsg,
        original: code.substring(0, 800) + (code.length > 800 ? '...' : '')
      });
    });

  } catch (e) {
    res.render('index', { result: null, error: 'Error interno: ' + e.message });
  }
});

app.listen(port, () => {
  console.log(`Servidor corriendo → http://localhost:${port}`);
});
