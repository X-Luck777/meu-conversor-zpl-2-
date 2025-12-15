// --- INÍCIO DOS POLYFILLS (Para corrigir o erro "Go.run" / "crypto") ---
// Isso "engana" a biblioteca fazendo ela achar que está num navegador
const crypto = require('crypto');
const util = require('util');
const { performance } = require('perf_hooks');

if (!globalThis.crypto) {
    globalThis.crypto = crypto.webcrypto ? crypto.webcrypto : {
        getRandomValues: (arr) => crypto.randomBytes(arr.length)
    };
}
if (!globalThis.TextEncoder) globalThis.TextEncoder = util.TextEncoder;
if (!globalThis.TextDecoder) globalThis.TextDecoder = util.TextDecoder;
if (!globalThis.performance) globalThis.performance = performance;
// --- FIM DOS POLYFILLS ---

const express = require('express');
const bodyParser = require('body-parser');
const PDFDocument = require('pdfkit');
const { Renderer } = require('zpl-renderer-js');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.text({ limit: '200mb' }));
app.use(express.static('public'));

app.post('/convert', async (req, res) => {
    try {
        const zplData = req.body;
        if (!zplData || zplData.trim().length === 0) {
            return res.status(400).send('Nenhum código ZPL recebido.');
        }

        // Separa as etiquetas
        let rawLabels = zplData.split('^XZ');
        const labels = rawLabels
            .filter(l => l.includes('^XA'))
            .map(l => l.trim() + '^XZ');

        console.log(`Processando ${labels.length} etiquetas...`);

        if (labels.length === 0) {
             return res.status(400).send('Nenhuma etiqueta válida encontrada.');
        }

        // PDF Config
        const doc = new PDFDocument({ autoFirstPage: false, size: [288, 432], margin: 0 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=etiquetas.pdf');
        doc.pipe(res);

        const renderer = new Renderer();

        let processedCount = 0;
        for (const labelZPL of labels) {
            processedCount++;
            doc.addPage();

            try {
                // Tenta renderizar
                const renderResult = await renderer.render(labelZPL);
                
                // Desenha no PDF
                doc.image(renderResult, 0, 0, { width: 288, height: 432, fit: [288, 432] });

            } catch (renderError) {
                console.error(`Erro na etiqueta ${processedCount}:`, renderError.message);
                
                // Fallback de erro
                doc.fillColor('red').fontSize(12).text('Erro visualização', 10, 20);
                doc.fillColor('black').fontSize(6).text('Erro: ' + renderError.message, 10, 40);
                doc.fontSize(4).text(labelZPL.substring(0, 500), 10, 60, {width: 260});
            }
        }

        doc.end();

    } catch (error) {
        console.error("Erro fatal:", error);
        if (!res.headersSent) res.status(500).send('Erro no servidor: ' + error.message);
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
