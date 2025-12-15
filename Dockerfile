# Mudamos para Node 20 (mais moderno e compatível com WebAssembly)
FROM node:20-bullseye

# Instala dependências de sistema para o Canvas
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

# Copia o package.json
COPY package.json ./

# Instala dependências do Node
RUN npm install --build-from-source

# Copia o código do servidor
COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
