# MMG Creativity — Bugün değiştirilen dosyaların güncel halini tek bir zip'e toplar.
# Kullanım: zip-degisiklikler.bat dosyasına çift tıkla (bu .ps1'i çağırır).

$ErrorActionPreference = "Stop"
$root  = Split-Path -Parent $MyInvocation.MyCommand.Path   # ...\web\html
$stage = Join-Path $env:TEMP ("mmg-degisiklikler-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
New-Item -ItemType Directory -Path $stage | Out-Null
New-Item -ItemType Directory -Path (Join-Path $stage "functions") | Out-Null

# html klasöründeki değişen dosyalar
$files = @(
  "index.html",
  "Vade_Sapma_Hesaplama.html",
  "vadeli-mevduat-faizi-hesaplama.html",
  "Rotatif_Kredi_Hesaplama.html",
  "Kredi_Karti_Vade_Farki_Hesaplama.html",
  "Ortalama_Vade_Hesaplama.html",
  "kredi-karsilastirma.html",
  "Forum.html",
  "Blog.html",
  "profil.html",
  "Nakit_Akis_Tablosu.html",
  "Giderler.html",
  "Gelirler.html",
  "mmg-odemeler-sync.js",
  "firestore.rules",
  "GUVENLIK-INCELEMESI.md",
  "BUGUN-YAPILANLAR.md"
)
foreach ($f in $files) {
  $src = Join-Path $root $f
  if (Test-Path $src) { Copy-Item $src (Join-Path $stage $f) -Force }
  else { Write-Host ("Atlandi (bulunamadi): " + $f) }
}

# functions/index.js
$fnSrc = Join-Path $root "functions\index.js"
if (Test-Path $fnSrc) { Copy-Item $fnSrc (Join-Path $stage "functions\index.js") -Force }

# CLAUDE.md (proje kökünde)
$claudeSrc = Join-Path $root "..\..\CLAUDE.md"
if (Test-Path $claudeSrc) { Copy-Item $claudeSrc (Join-Path $stage "CLAUDE.md") -Force }

$out = Join-Path $root ("mmg-guncel-degisiklikler-" + (Get-Date -Format "yyyyMMdd") + ".zip")
if (Test-Path $out) { Remove-Item $out -Force }
Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $out -Force
Remove-Item $stage -Recurse -Force

Write-Host ""
Write-Host "ZIP HAZIR:" -ForegroundColor Green
Write-Host $out
