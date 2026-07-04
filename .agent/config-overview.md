# Cấu hình Antigravity IDE (.agent/)
Chào mừng bạn đến với trình cấu hình nâng cao dành cho Google Antigravity IDE.

Thư mục `.agent/` đặt tại gốc dự án là nơi lưu trữ toàn bộ chỉ thị, kỹ năng và quy trình hoạt động để huấn luyện AI coding assistant hiểu sâu sắc về codebase của bạn.

## 📁 Sơ đồ cấu trúc thư mục tối ưu:
- **Rules (`.agent/rules/`):** Nơi chứa quy chuẩn hành vi cốt lõi `GEMINI.md`.
- **Skills (`.agent/skills/`):** Các mô-đun kỹ năng phân rã thông minh (`SKILL.md`) giúp AI hoạt động chuẩn xác theo từng công nghệ mà không làm tràn bộ nhớ token.
- **Agents (`.agent/agents/`):** Định nghĩa vai trò các tác nhân AI chuyên biệt (Subagents) như Debugger, Orchestrator, Database Architect...
- **Workflows (`.agent/workflows/`):** Kịch bản tự động hóa các tác vụ lặp đi lặp lại như chạy test, xác minh code, điều phối tác nhân.
