Add-Type -AssemblyName System.IO.Compression.FileSystem

$files = Get-ChildItem -Path 'D:\Jhonlin\SAP\SAC\Document' -Filter 'Story Builder Spec*.xlsx' -Recurse
foreach ($file in $files) {
    try {
        $zip = [System.IO.Compression.ZipFile]::OpenRead($file.FullName)
        $images = $zip.Entries | Where-Object { $_.FullName -like 'xl/media/*' }
        Write-Host "$($file.Directory.Name)/$($file.Name) has $($images.Count) images"
        foreach ($img in $images | Select-Object -First 3) {
            Write-Host "   -> $($img.FullName) ($($img.Length) bytes)"
        }
        $zip.Dispose()
    } catch {
        Write-Host "Error opening $($file.Name): $_"
    }
}
