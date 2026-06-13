# Discord-route-deck

## Biblioteca local de sonidos

Los audios no se guardan en el repositorio remoto. Cada instalación debe crear
la biblioteca local dentro de `sounds/` y proporcionar sus propios archivos:

```text
sounds/
├── anime/
│   └── archivos.mp3
├── memes/
│   └── archivos.mp3
└── terror/
    └── archivos.mp3
```

Para crear la estructura:

```bash
mkdir -p sounds/anime sounds/memes sounds/terror
```

Los archivos de audio dentro de estas carpetas están excluidos mediante
`.gitignore`. Los archivos `.gitkeep` mantienen únicamente la estructura de
directorios en Git.
