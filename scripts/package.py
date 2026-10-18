from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parent.parent
dest = root / 'dist'
dest.mkdir(exist_ok=True)
(dest / 'StreamingUtils-Setup.cmd').write_bytes((root / 'extension/setup/YouTubeUtils-Setup.cmd').read_bytes())
with ZipFile(dest / 'StreamingUtils-Windows.zip', 'w', ZIP_DEFLATED) as archive:
    for folder in ('extension', 'native'):
        for file in sorted((root / folder).rglob('*')):
            if file.is_file():
                archive.write(file, 'StreamingUtils/' + file.relative_to(root).as_posix())
    for name in ('Installieren.cmd', 'Programme-aktualisieren.cmd', 'extension-id.txt', 'README.md', 'LICENSE'):
        archive.write(root / name, 'StreamingUtils/' + name)
print(dest / 'StreamingUtils-Windows.zip')
