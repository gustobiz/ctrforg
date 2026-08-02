Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead("C:\Users\new manju\Downloads\Gusto_Outreach_CRM.xlsx")
$zip.Entries | ForEach-Object { Write-Output $_.FullName }


# 1. Read shared strings
$stringsEntry = $zip.Entries | Where-Object { $_.FullName -eq "xl/sharedStrings.xml" }
$strings = @()
if ($stringsEntry) {
    $stream = $stringsEntry.Open()
    $reader = New-Object System.IO.StreamReader($stream)
    $xml = [xml]$reader.ReadToEnd()
    $reader.Close()
    $stream.Close()
    foreach ($sst in $xml.sst.si) {
        $strings += $sst.t.InnerText
    }
}

# 2. Read sheet1
$sheetEntry = $zip.Entries | Where-Object { $_.FullName -eq "xl/worksheets/sheet1.xml" }
if ($sheetEntry) {
    $stream = $sheetEntry.Open()
    $reader = New-Object System.IO.StreamReader($stream)
    $xml = [xml]$reader.ReadToEnd()
    $reader.Close()
    $stream.Close()
    
    # Let's print rows and cell values
    foreach ($row in $xml.worksheet.sheetData.row) {
        $rowCells = @()
        foreach ($c in $row.c) {
            $val = ""
            if ($c.v) {
                $val = $c.v.InnerText
                # If cell type is 's' (shared string), resolve it
                if ($c.t -eq "s") {
                    $val = $strings[[int]$val]
                }
            }
            $rowCells += $val
        }
        Write-Output ($rowCells -join " | ")
    }
}
$zip.Dispose()
