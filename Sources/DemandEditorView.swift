import SwiftUI
import AppKit

struct DemandEditorView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var store: DemandStore
    @ObservedObject var drafts: EditorDraftStore
    @State private var draft: Demand
    @State private var hasDueDate: Bool
    @State private var confirmDelete = false
    @State private var confirmDiscard = false
    @State private var progressDraft = ""

    @State private var changeDraft = ""
    @State private var original: Demand?
    @State private var finished = false
    private let initial: Demand
    private let draftKey: String
    private let restored: Bool

    init(demand: Demand, store: DemandStore, drafts: EditorDraftStore) {
        self.store = store
        self.drafts = drafts
        let existing = store.demands.first { $0.id == demand.id }
        let matchingKey = drafts.drafts.first { $0.value.demand.id == demand.id }?.key
        let key = matchingKey ?? (existing == nil ? "new" : demand.id.uuidString)
        let saved = drafts.drafts[key]
        let value = saved?.demand ?? existing ?? demand
        self.initial = existing ?? Demand()
        self.draftKey = key
        self.restored = saved != nil
        _original = State(initialValue: saved == nil ? existing : saved!.expected)
        _draft = State(initialValue: value)
        _hasDueDate = State(initialValue: value.dueDate != nil)
        _progressDraft = State(initialValue: saved?.progressText ?? "")
        _changeDraft = State(initialValue: saved?.changeText ?? "")
    }

    private var changed: Bool {
        let baseline = original ?? initial
        // New UUIDs do not count as edits to an otherwise empty form.
        var value = draft
        if original == nil { value.id = baseline.id; value.createdAt = baseline.createdAt; value.updatedAt = baseline.updatedAt }
        return !value.hasSameContent(as: baseline) || !progressDraft.isEmpty || !changeDraft.isEmpty
    }

    private var conflict: Bool {
        guard let original else { return store.demands.contains { $0.id == draft.id } }
        return !(store.demands.first { $0.id == draft.id }?.hasSameContent(as: original) ?? false)
    }

    private var isExisting: Bool {
        store.demands.contains { $0.id == draft.id }
    }

    private var canSave: Bool {
        !draft.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        draft.spell.isValid
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text(isExisting ? "编辑需求" : "新增需求")
                    .font(.title2.weight(.semibold))
                Spacer()
                if isExisting {
                    Button("删除", role: .destructive) { confirmDelete = true }
                        .foregroundStyle(.red)
                        .disabled(conflict || original == nil)
                }
            }
            .padding(24)
            Divider()
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    if restored {
                        Text("已恢复本机草稿。保存后生效，关闭会继续保留。")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                    if conflict {
                        Label("已保存的需求发生变化；草稿仍保留。请先复制需要的内容，再放弃草稿并重新打开核对。",
                              systemImage: "exclamationmark.triangle")
                            .font(.callout).foregroundStyle(.orange)
                    }
                    section("需求") {
                        TextField("标题（必填）", text: $draft.title)
                            .textFieldStyle(.roundedBorder)
                        TextField("项目（选填）", text: $draft.project)
                            .textFieldStyle(.roundedBorder)
                        VStack(alignment: .leading, spacing: 5) {
                            Text("背景与备注").font(.caption).foregroundStyle(.secondary)
                            TextEditor(text: $draft.notes)
                                .frame(height: 74)
                                .overlay(RoundedRectangle(cornerRadius: 6)
                                    .strokeBorder(.quaternary))
                        }
                    }
                    section("分类与状态") {
                        HStack {
                            Picker("四象限", selection: $draft.quadrant) {
                                ForEach(Quadrant.allCases) { quadrant in
                                    Text(quadrant.title).tag(quadrant)
                                }
                            }
                            Picker("状态", selection: $draft.status) {
                                ForEach(DemandStatus.allCases) { status in
                                    Text(status.title).tag(status)
                                }
                            }
                        }
                        Toggle("设置截止日期", isOn: $hasDueDate)
                            .onChange(of: hasDueDate) { _, enabled in
                                draft.dueDate = enabled ? (draft.dueDate ?? Date()) : nil
                            }
                        if hasDueDate {
                            DatePicker("截止日期", selection: Binding(
                                get: { draft.dueDate ?? Date() },
                                set: { draft.dueDate = $0 }
                            ), displayedComponents: .date)
                        }
                    }
                    section("进度") {
                        Text("本次进展会在保存需求时追加。")
                            .font(.caption).foregroundStyle(.secondary)
                        TextEditor(text: $progressDraft)
                            .frame(height: 80)
                            .overlay(RoundedRectangle(cornerRadius: 6)
                                .strokeBorder(.quaternary))
                        ForEach(draft.progress.reversed()) { entry in
                            VStack(alignment: .leading, spacing: 4) {
                                Text(entry.createdAt.formatted(date: .abbreviated, time: .shortened))
                                    .font(.caption).foregroundStyle(.secondary)
                                Text(entry.text).font(.subheadline)
                                    .textSelection(.enabled)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.vertical, 4)
                            Divider()
                        }
                    }
                    section("咒言 · 发给 AI 的上下文") {
                        Text("留空也能保存需求；填写咒言时“要做什么”必填。")
                            .font(.caption).foregroundStyle(.secondary)
                        spellField("代码入口", placeholder: "服务、流程描述或代码路径",
                                   text: $draft.spell.codeEntry, height: 68)
                        spellField("可能有用的资料", placeholder: "文档名称、链接或路径",
                                   text: $draft.spell.materials, height: 68)
                        spellField("要做什么", placeholder: "目标、预期行为与验收方式",
                                   text: $draft.spell.intent, height: 110)
                        spellField("补充说明", placeholder: "范围、约束或处理偏好",
                                   text: $draft.spell.supplement, height: 68)
                        if !draft.spell.isValid {
                            Label("填写咒言时，请写明“要做什么”。",
                                  systemImage: "exclamationmark.circle")
                                .font(.caption).foregroundStyle(.orange)
                        }
                    }
                    section("追加变更") {
                        Text("保留原目标，在这里写本轮调整；保存时追加，未完成的验证继续保留。")
                            .font(.caption).foregroundStyle(.secondary)
                        spellField("这次要改什么", placeholder: "在已有实现上调整什么？",
                                   text: $changeDraft, height: 90)
                        ForEach(Array(draft.changes.enumerated().reversed()), id: \.element.id) { index, change in
                            DisclosureGroup("C\(String(format: "%03d", index + 1)) · \(change.createdAt.formatted(date: .abbreviated, time: .shortened))") {
                                Text(change.text).textSelection(.enabled)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                            .font(.subheadline)
                        }
                    }
                    section("交接摘要") {
                        Text("手动概括当前任务。填写下一步和验证结果后，更新摘要会涵盖当前进度；复制时带上摘要和之后的新进度。完整历史保留在上方。")
                            .font(.caption).foregroundStyle(.secondary)
                        spellField("已完成", placeholder: "当前已经实现的结果", text: $draft.handoff.completed, height: 70)
                        spellField("下一步", placeholder: "剩余事项与接手入口", text: $draft.handoff.pending, height: 70)
                        spellField("关键决定", placeholder: "已确定的方案与限制", text: $draft.handoff.decisions, height: 70)
                        spellField("验证结果", placeholder: "通过、失败和尚未执行的检查", text: $draft.handoff.verification, height: 70)
                    }
                    if let error = drafts.errorMessage ?? store.errorMessage {
                        Label(error, systemImage: "exclamationmark.triangle")
                            .font(.callout).foregroundStyle(.red)
                    }
                }
                .padding(24)
            }
            Divider()
            HStack(spacing: 10) {
                Button("关闭", action: requestClose)
                if changed || drafts.drafts[draftKey] != nil {
                    Button("放弃草稿") { confirmDiscard = true }.foregroundStyle(.secondary)
                }
                Spacer()
                Button("保存") { save(copy: false) }
                    .disabled(!canSave || conflict)
                    .keyboardShortcut("s", modifiers: .command)
                Button("保存并复制咒言") { save(copy: true) }
                    .disabled(!canSave || conflict || draft.spell.isEmpty)
                    .buttonStyle(.borderedProminent)
                    .keyboardShortcut(.return, modifiers: [.command])
            }
            .padding(20)
        }
        .frame(minWidth: 560, idealWidth: 650, minHeight: 550, idealHeight: 720)
        .confirmationDialog("删除这条需求？", isPresented: $confirmDelete) {
            Button("删除需求", role: .destructive) {
                if store.remove(draft.id, expected: original) {
                    if drafts.remove(draftKey) { finished = true; dismiss() }
                }
            }
        } message: {
            Text("此操作会从本机需求数据中移除这条记录。")
        }
        .confirmationDialog("放弃未保存的修改？", isPresented: $confirmDiscard) {
            Button("放弃草稿", role: .destructive) {
                if drafts.remove(draftKey) { finished = true; dismiss() }
            }
            Button("继续编辑", role: .cancel) {}
        }
        .onExitCommand(perform: requestClose)
        .onChange(of: draft) { _, _ in preserve() }
        .onChange(of: progressDraft) { _, _ in preserve() }
        .onChange(of: changeDraft) { _, _ in preserve() }
        .onDisappear { if !finished { preserve() } }
    }

    private func section<Content: View>(
        _ title: String, @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title).font(.headline)
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Color(nsColor: .controlBackgroundColor),
                    in: RoundedRectangle(cornerRadius: 10))
    }

    private func spellField(
        _ title: String, placeholder: String, text: Binding<String>, height: CGFloat
    ) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack {
                Text(title).font(.subheadline.weight(.medium))
                Spacer()
                if text.wrappedValue.isEmpty {
                    Text(placeholder).font(.caption).foregroundStyle(.tertiary)
                }
            }
            TextEditor(text: text)
                .frame(height: height)
                .overlay(RoundedRectangle(cornerRadius: 6)
                    .strokeBorder(.quaternary))
        }
    }

    @discardableResult
    private func preserve() -> Bool {
        if finished { return true }
        if !changed { return drafts.remove(draftKey) }
        return drafts.save(EditorDraft(demand: draft, expected: original,
                                      progressText: progressDraft, changeText: changeDraft))
    }

    private func requestClose() {
        if preserve() { finished = true; dismiss() }
    }

    private func save(copy: Bool) {
        draft.title = draft.title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard canSave, !conflict, preserve(),
              store.upsert(draft, expected: original, progressText: progressDraft, changeText: changeDraft),
              let saved = store.demands.first(where: { $0.id == draft.id }) else { return }
        finished = true
        _ = drafts.remove(draftKey)
        if copy {
            NSPasteboard.general.clearContents()
            NSPasteboard.general.setString(saved.spell.prompt(for: saved), forType: .string)
        }
        dismiss()
    }
}
