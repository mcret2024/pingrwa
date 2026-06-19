# -*- coding: utf-8 -*-
"""Bump all HTML cache busters to v845-cache-bust."""
import sys, io, os, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

ROOT = r'D:\ai\new_silica\silica'
PREFIX_LEN = len(ROOT) + 1

# Matches ?v=20260524v821-index-header-gap or &v=20260524v821-foo
pattern = re.compile(r'(\?|&)v=\d{8}v\d+-[a-z0-9-]+', re.IGNORECASE)
new_v = 'v=20260526v850-image-swap'

changed_files = 0
total_replacements = 0

for root, dirs, files in os.walk(ROOT):
    for skip in ('.git', '_backup', 'vendor', '_manual_build', 'node_modules'):
        if skip in dirs:
            dirs.remove(skip)
    for f in files:
        if not f.endswith('.html'):
            continue
        path = os.path.join(root, f)
        with open(path, 'r', encoding='utf-8') as fh:
            content = fh.read()
        matches = pattern.findall(content)
        if not matches:
            continue
        count = len(matches)
        new_content = pattern.sub(lambda m: m.group(1) + new_v, content)
        if new_content != content:
            with open(path, 'w', encoding='utf-8') as fh:
                fh.write(new_content)
            changed_files += 1
            total_replacements += count
            rel = path[PREFIX_LEN:]
            print('  %-50s (%d)' % (rel, count))

print()
print('Total: %d files modified, %d cache busters updated' % (changed_files, total_replacements))
