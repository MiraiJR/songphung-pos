param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Printer
)

$ErrorActionPreference = 'Stop'

$text = Get-Content -LiteralPath $Path -Raw -Encoding UTF8

Add-Type -AssemblyName System.Drawing

$doc = New-Object System.Drawing.Printing.PrintDocument
$doc.PrinterSettings.PrinterName = $Printer
$doc.DocumentName = "SongPhung Receipt"

if (-not $doc.PrinterSettings.IsValid) {
    throw "Máy in không hợp lệ: $Printer"
}

# 80mm thermal paper: 80mm ≈ 315 hundredths of an inch.
$doc.DefaultPageSettings.Landscape = $false
$doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)
$doc.DefaultPageSettings.PaperSize = New-Object System.Drawing.Printing.PaperSize("K80", 315, 1100)

$font = New-Object System.Drawing.Font("Courier New", 10, [System.Drawing.FontStyle]::Bold)
$brush = [System.Drawing.Brushes]::Black
$format = New-Object System.Drawing.StringFormat([System.Drawing.StringFormatFlags]::NoClip)
$format.Trimming = [System.Drawing.StringTrimming]::None
$format.FormatFlags = $format.FormatFlags -bor [System.Drawing.StringFormatFlags]::LineLimit

$lineIndex = 0
$lines = $text -split "`r?`n"

$handler = [System.Drawing.Printing.PrintPageEventHandler]{
    param($sender, $e)

    $printableWidth = [Math]::Max(1, $e.PageBounds.Width - 2)
    $lineHeight = [Math]::Ceiling($font.GetHeight($e.Graphics))
    $y = 0

    while ($lineIndex -lt $lines.Length) {
        if ($y + $lineHeight -gt $e.PageBounds.Height) {
            $e.HasMorePages = $true
            return
        }
        $line = $lines[$lineIndex]
        $rect = New-Object System.Drawing.RectangleF(0, $y, $printableWidth, $lineHeight + 2)
        $e.Graphics.DrawString($line, $font, $brush, $rect, $format)
        $y += $lineHeight
        $lineIndex++
    }

    $e.HasMorePages = $false
}

$doc.add_PrintPage($handler)
try {
    $doc.Print()
} finally {
    $doc.remove_PrintPage($handler)
    $doc.Dispose()
    $font.Dispose()
    $format.Dispose()
}

Remove-Item -LiteralPath $Path -ErrorAction SilentlyContinue
