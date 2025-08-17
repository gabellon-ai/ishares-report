- name: Run scraper -> public/funds.json
  shell: pwsh
  run: |
    python .\batch_export_json.py
    if (-not (Test-Path .\public\funds.json)) { throw "public\funds.json not found after scraper run" }
