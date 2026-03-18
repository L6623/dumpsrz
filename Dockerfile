# Imagen base ligera con Node 20 y Debian (compatible con Render)
FROM node:20-bookworm-slim

# Instala lua5.1 (el binario se llama lua5.1, no lua)
RUN apt-get update && \
    apt-get install -y --no-install-recommends lua5.1 && \
    rm -rf /var/lib/apt/lists/* && \
    # Crea alias para que 'lua' funcione (por si el CLI lo espera así)
    ln -s /usr/bin/lua5.1 /usr/bin/lua

# Directorio de trabajo
WORKDIR /app

# Copia todo el proyecto
COPY . .

# Instala solo las dependencias de producción en la carpeta web/
RUN cd web && npm ci --production --omit=dev

# Variable PORT que Render asigna automáticamente
ENV PORT=10000
EXPOSE 10000

# Comando de inicio (ejecuta el server desde la carpeta web)
CMD ["node", "web/index.js"]
