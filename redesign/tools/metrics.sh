#!/usr/bin/env bash
# Counts hard-coded / inconsistent styling in screen code. Used by the audit and the Phase 3 grep.
cd "$(dirname "$0")/../.."
G() { grep -rhoE "$1" app components --include=*.tsx --exclude-dir=__tests__ --exclude-dir=ui "${@:2}"; }
N() { grep -rnE "$1" app components --include=*.tsx --exclude-dir=__tests__ --exclude-dir=ui | wc -l | tr -d ' '; }
echo "hex/rgb/hsl literals:      $(N '#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(')"
echo "arbitrary px/rem classes:  $(N '\[[0-9.]+(px|rem)\]')"
echo "inline style={{}}:         $(N 'style=\{\{')"
echo "raw palette colors:        $(N '\b(bg|text|border|ring)-(red|blue|green|amber|yellow|slate|gray|zinc|orange|purple|pink|emerald|teal|sky|indigo|violet|rose|neutral|stone)-[0-9]{2,3}')"
echo "raw <button>:              $(N '<button')"
echo "<Button>:                  $(N '<Button')"
echo "raw <input>:               $(N '<input')"
echo "raw <select>:              $(N '<select')"
echo "raw <textarea>:            $(N '<textarea')"
echo "--- text sizes";  G '\btext-(xs|sm|base|lg|xl|2xl|3xl|4xl|\[[^]]+\])\b' | sort | uniq -c | sort -rn
echo "--- font weights"; G '\bfont-(normal|medium|semibold|bold)\b' | sort | uniq -c | sort -rn
echo "--- radii"; G '\brounded(-(sm|md|lg|xl|2xl|3xl|full|none|\[[^]]+\]))?\b' | sort | uniq -c | sort -rn
echo "--- tone/semantic colors used"; G '\b(bg|text|border)-(tone-[a-z]+|primary|destructive|muted-foreground|muted|accent|secondary|card|background)(/[0-9]+)?' | sort | uniq -c | sort -rn | head -25
echo "--- padding steps"; G '\bp[xy]?-[0-9.]+\b' | sort | uniq -c | sort -rn | head -14
echo "--- gap steps"; G '\bgap-[0-9.]+\b' | sort | uniq -c | sort -rn | head -10
