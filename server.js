// --- POLYFILLS (Engana a lib para rodar fora do navegador) ---
import crypto from 'crypto';
import { TextEncoder, TextDecoder } from 'util';
import { performance } from 'perf_hooks';
import { createCanvas } from 'canvas';

// Define globais que a biblioteca zpl-renderer-js exige
if (!globalThis.crypto) globalThis.crypto = { getRandomValues: (arr) => crypto.randomBytes(arr.length) };
if (!globalThis.TextEncoder) globalThis.TextEncoder = TextEncoder;
if (!globalThis.TextDecoder) globalThis.TextDecoder = TextDecoder;
if (!globalThis.performance) globalThis.performance = performance;

globalThis.window = globalThis;
globalThis.self = globalThis;
globalThis.document = {
    createElement: (tag) => {
        // Se a lib pedir um canvas, entregamos um do Node
        if (tag === 'canvas') return createCanvas(1, 1);
        return {};
    }
};
// --- FIM DOS POLYFILLS ---

import express from 'express';
import bodyParser from 'body-parser';
import PDFDocument from 'pdfkit';
// A importação correta em ES Modules
import Renderer from 'zpl-renderer-js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.text({ limit: '500mb' }));
app.use(express.static('public'));

app.post('/convert', async (req, res) => {
    try {
        const zplData = req.body;
        if (!zplData || zplData.trim().length === 0) {
            return res.status(400).send('ZPL Vazio');
        }

        // Separação segura das etiquetas
        const regex = /\^XA[\s\S]*?\^XZ/g;
        const labels = zplData.match(regex);

        if (!labels || labels.length === 0) {
             return res.status(400).send('Nenhuma etiqueta ^XA...^XZ encontrada.');
        }

        // Inicia o PDF
        const doc = new PDFDocument({ autoFirstPage: false, size: [288, 432], margin: 0 });
        
        // Envia cabeçalhos. A partir daqui, NÃO podemos mais usar res.status().send()
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=etiquetas.pdf');
        doc.pipe(res);

        const renderer = new Renderer();

        console.log(`Iniciando conversão de ${labels.length} etiquetas...`);

        for (let i = 0; i < labels.length; i++) {
            doc.addPage();
            try {
                // Tenta renderizar a etiqueta atual
                const renderResult = await renderer.render(labels[i]);
                
                // Se deu certo, desenha
                doc.image(renderResult, 0, 0, { width: 288, height: 432, fit: [288, 432] });

            } catch (renderError) {
                // Se der erro nesta etiqueta, NÃO derruba o servidor.
                // Apenas escreve o erro no PDF e pula para a próxima.
                console.error(`Erro na etiqueta ${i+1}:`, renderError.message);
                
                doc.fillColor('red').fontSize(12).text(`ERRO NA ETIQUETA ${i+1}`, 20, 50);
                doc.fillColor('black').fontSize(8).text(renderError.message, 20, 70);
                doc.fontSize(6).text(labels[i].substring(0, 100) + '...', 20, 100, {width: 250});
            }
        }

        doc.end();

    } catch (fatalError) {
        console.error("Erro Fatal:", fatalError);
        // Só envia erro 500 se o download ainda não tiver começado
        if (!res.headersSent) {
            res.status(500).send('Erro interno: ' + fatalError.message);
        } else {
            // Se já começou, encerra a conexão para não travar o navegador
            res.end();
        }
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});



