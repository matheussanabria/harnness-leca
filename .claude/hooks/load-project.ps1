# Hook UserPromptSubmit: injeta instruções + memória (global e do projeto ativo) a cada mensagem.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$activeFile = Join-Path $root "projects\.active"
# Tolerante: ignora BOM, linhas vazias e maiúsculas; vale a última linha preenchida.
$project = ""
if (Test-Path $activeFile) {
    $wanted = (Get-Content $activeFile -Encoding UTF8 | ForEach-Object { $_.Trim([char]0xFEFF).Trim() } | Where-Object { $_ } | Select-Object -Last 1)
    $match = Get-ChildItem (Join-Path $root "projects") -Directory | Where-Object { $_.Name -ieq $wanted } | Select-Object -First 1
    if ($match) { $project = $match.Name }
}

function Show($title, $path) {
    if (Test-Path $path) {
        $text = (Get-Content $path -Raw -Encoding UTF8).Trim()
        if ($text) { "## $title`n$text`n" }
    }
}

"<project-harness>"
if ($project -and (Test-Path (Join-Path $root "projects\$project"))) {
    $pdir = Join-Path $root "projects\$project"
    "Projeto ativo: $project (pasta: projects/$project)"
    "Arquivos de contexto: projects/$project/context/ (leia sob demanda)"
    "Chats salvos: projects/$project/chats/"
    ""
    Show "Instruções globais" (Join-Path $root "global\instructions.md")
    Show "Instruções do projeto" (Join-Path $pdir "instructions.md")
    Show "Memória global" (Join-Path $root "global\memory.md")
    Show "Memória do projeto" (Join-Path $pdir "memory.md")
    $ctx = Get-ChildItem (Join-Path $pdir "context") -File -ErrorAction SilentlyContinue | Where-Object Name -ne ".gitkeep"
    if ($ctx) { "## Arquivos em context/"; $ctx | ForEach-Object { "- projects/$project/context/$($_.Name)" } }
} else {
    "Nenhum projeto ativo (defina o slug em projects/.active). Pastas disponíveis:"
    Get-ChildItem (Join-Path $root "projects") -Directory | Where-Object Name -ne "_template" | ForEach-Object { "- $($_.Name)" }
    ""
    Show "Instruções globais" (Join-Path $root "global\instructions.md")
    Show "Memória global" (Join-Path $root "global\memory.md")
}
"</project-harness>"
