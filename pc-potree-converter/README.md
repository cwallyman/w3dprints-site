# PC Potree Converter

Tiny local Windows app for converting `.las` and `.laz` files into Potree folders, then opening them in the Potree viewer.

## Install

1. Install Node.js LTS.
2. Install PotreeConverter for Windows.
3. Make sure `PotreeConverter.exe` is on your PATH, or edit `start-windows.bat` and add:

```bat
set POTREE_CONVERTER=C:\Tools\PotreeConverter\PotreeConverter.exe
```

## Run

Double-click:

```text
start-windows.bat
```

Then open:

```text
http://localhost:8787
```

Drag and drop a `.las` or `.laz` file onto the upload box, or paste a full file path, for example:

```text
C:\Users\you\Desktop\train.laz
```

Click **Convert to Potree**. When conversion finishes, click **Open in Potree Viewer**.

## Output

Converted clouds are written to:

```text
pc-potree-converter\data\pointclouds
```

Dropped/uploaded source files are stored in:

```text
pc-potree-converter\data\uploads
```

Uploads are not sent anywhere. This app runs locally on your PC.
