const express = require('express');
const { execFile } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const rateLimit = require('express-rate-limit');
const multer = require('multer');

const app = express();
const port = process.env.PORT || 3000;

const limiter = rateLimit({
  windowMs: 2 * 60 * 1000, // 2 minutos
  max: 8,                  // max 8 requests por IP
  message: 'Demasiadas solicitudes, espera un momento.'
});

app.use(limiter);
app.use(express.urlencoded({ extended: true, limit: '6mb' }));
app.use(express.json({ limit: '6mb' }));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const upload = multer({ dest: '/tmp/', limits: { fileSize: 6 * 1024 * 1024 } });

app.get('/', (req, res) => {
  res.render('index', { result: null, error: null, original: null });
});

app.post('/deob', upload.single('file'), async (req, res) => {
  let code = req.body.code || '';
  const file = req.file;

  if (file) {
    try {
      code = await fs.readFile(file.path, 'utf-8');
      fs.unlink(file.path).catch(() => {});
    } catch {
      return res.render('index', { result: null, error: 'No se pudo leer el archivo', original: null });
    }
  }

  if (!code.trim()) {
    return res.render('index', { result: null, error: 'Pega código o sube un .lua válido', original: null });
  }

  const inputPath = path.join('/tmp', `input_${Date.now()}.lua`);
  const outputPath = path.join('/tmp', `output_${Date.now()}.lua`);

  try {
    await fs.writeFile(inputPath, code);

    const deobPath = path.join(__dirname, '..', 'src', 'deob', 'cli.lua');
    const args = [deobPath, inputPath, '--out', outputPath];

    execFile('lua', args, { timeout: 60000 }, async (err, stdout, stderr) => {
      let result = '';
      let errorMsg = null;

      if (err || stderr) {
        errorMsg = stderr?.trim() || err?.message || 'Error en el deobfuscator (posible timeout o código inválido)';
      } else {
        try {
          result = await fs.readFile(outputPath, 'utf-8');
        } catch {
          errorMsg = 'Se procesó pero no se pudo leer el resultado';
        }
      }

      // Limpieza
      fs.unlink(inputPath).catch(() => {});
      fs.unlink(outputPath).catch(() => {});

      res.render('index', {
        result: result || null,
        error: errorMsg,
        original: code.length > 1000 ? code.substring(0, 1000) + '...' : code
      });
    });

  } catch (e) {
    res.render('index', { result: null, error: 'Error interno: ' + e.message, original: null });
  }
});

app.listen(port, () => {
  console.log(`App corriendo en puerto ${port}`);
});
