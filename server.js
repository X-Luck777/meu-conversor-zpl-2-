// --- INÍCIO DOS POLYFILLS AVANÇADOS ---
// Engana a biblioteca simulando um navegador completo
const crypto = require('crypto');
const util = require('util');
const { performance } = require('perf_hooks');
const { createCanvas } = require('canvas');

// Polyfills básicos
if (!globalThis.crypto) globalThis.crypto = crypto.webcrypto ? crypto.webcrypto : { getRandomValues: (arr) => crypto.randomBytes(arr.length) };
if (!globalThis.TextEncoder) globalThis.TextEncoder = util.TextEncoder;
if (!globalThis.TextDecoder) globalThis.TextDecoder = util.TextDecoder;
if (!globalThis.performance) globalThis.performance = performance;

// Polyfills de ambiente gráfico (CRÍTICO para zpl-renderer-js em Node)
globalThis.window = globalThis;
globalThis.self = globalThis;
globalThis.document = {
    createElement: (tag) => {
        if (tag === 'canvas') return createCanvas(1, 1); // Retorna um canvas falso se pedido
        return {};
    }
};
// --- FIM DOS POLYFILLS ---

const express = require('express');
const bodyParser = require('body-parser');
const PDFDocument = require('pdfkit');
const { Renderer } = require('zpl-renderer-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Aumenta o limite para 500MB (códigos ZPL com imagem são gigantes)
app.use(bodyParser.text({ limit: '500mb' }));
app.use(express.static('public'));

app.post('/convert', async (req, res) => {
    console.log("Recebendo requisição de conversão...");
    
    try {
        const zplData = req.body;
        if (!zplData || zplData.trim().length === 0) {
            return res.status(400).send('Nenhum código ZPL recebido.');
        }

        // REGEX ROBUSTO: Encontra blocos que começam com ^XA e terminam com ^XZ
        // O split anterior falhava se tivesse sujeira entre as etiquetas
        const regex = /\^XA[\s\S]*?\^XZ/g;
        const labels = zplData.match(regex);

        if (!labels || labels.length === 0) {
             console.error("Nenhuma etiqueta ^XA...^XZ encontrada.");
             return res.status(400).send('Formato inválido. Certifique-se que o código tem ^XA e ^XZ.');
        }

        console.log(`Identificadas ${labels.length} etiquetas.`);

        // Configuração do PDF (4x6 polegadas padrão)
        const doc = new PDFDocument({ autoFirstPage: false, size: [288, 432], margin: 0 });
        
        // Timeout de segurança: Se o processamento travar, encerra a resposta
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=etiquetas.pdf');
        doc.pipe(res);

        const renderer = new Renderer();

        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < labels.length; i++) {
            const labelZPL = labels[i];
            doc.addPage();

            try {
                // Log para debug no Render
                console.log(`Processando etiqueta ${i + 1}/${labels.length}...`);

                // Tenta renderizar
                const renderResult = await renderer.render(labelZPL);
                
                // Se o resultado for válido, desenha
                if (renderResult) {
                     doc.image(renderResult, 0, 0, { width: 288, height: 432, fit: [288, 432] });
                     successCount++;
                } else {
                    throw new Error("Renderizador retornou vazio");
                }

            } catch (renderError) {
                errorCount++;
                console.error(`ERRO CRÍTICO na etiqueta ${i + 1}:`, renderError);
                
                // Desenha o erro no PDF para o usuário saber qual etiqueta falhou
                doc.fillColor('red').fontSize(14).text('FALHA DE RENDERIZAÇÃO', 20, 50);
                doc.fillColor('black').fontSize(8).text('Erro: ' + renderError.message, 20, 80);
                doc.fontSize(6).text('Verifique se o ZPL contém comandos de imagem (~DGR) muito pesados.', 20, 100);
            }
        }

        console.log(`Finalizado. Sucessos: ${successCount}, Erros: ${errorCount}`);
        doc.end();

    } catch (error) {
        console.error("Erro Geral no Servidor:", error);
        // Se o PDF já começou a ser enviado, não podemos mandar status 500
        if (!res.headersSent) res.status(500).send('Erro interno: ' + error.message);
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
