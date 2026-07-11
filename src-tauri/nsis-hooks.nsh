; ===== InkStone MD NSIS Installer Hooks =====
; 补充 Tauri 默认模板缺失的文件关联注册:
; 1. 写入 OpenWithProgids(确保出现在"打开方式"列表)
; 2. 安装/卸载后通知 Shell 刷新关联(SHChangeNotify)

!macro NSIS_HOOK_POSTINSTALL
  ; 将 ProgID 加入各扩展名的 OpenWithProgids 列表
  WriteRegStr SHELL_CONTEXT "Software\Classes\.md\OpenWithProgids" "InkStoneMD.Markdown" ""
  WriteRegStr SHELL_CONTEXT "Software\Classes\.markdown\OpenWithProgids" "InkStoneMD.Markdown" ""
  WriteRegStr SHELL_CONTEXT "Software\Classes\.txt\OpenWithProgids" "InkStoneMD.Text" ""

  ; 通知 Shell 文件关联已变更
  !insertmacro UPDATEFILEASSOC
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ; 移除 OpenWithProgids 条目
  DeleteRegValue SHELL_CONTEXT "Software\Classes\.md\OpenWithProgids" "InkStoneMD.Markdown"
  DeleteRegValue SHELL_CONTEXT "Software\Classes\.markdown\OpenWithProgids" "InkStoneMD.Markdown"
  DeleteRegValue SHELL_CONTEXT "Software\Classes\.txt\OpenWithProgids" "InkStoneMD.Text"

  ; 通知 Shell 刷新
  !insertmacro UPDATEFILEASSOC
!macroend
