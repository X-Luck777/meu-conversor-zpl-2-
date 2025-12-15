# Usa a imagem oficial do Node baseada em Debian (mais compatível)
FROM node:18-bullseye

# Instala TODAS as dependências de sistema necessárias para o Canvas
RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copia APENAS o package.json (ignora o package-lock.json propositalmente)
COPY package.json ./

# Instala as dependências.
# O flag --build-from-source força a recompilação do canvas para o sistema do Render
RUN npm install --build-from-source

# Copia o resto dos arquivos
COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
