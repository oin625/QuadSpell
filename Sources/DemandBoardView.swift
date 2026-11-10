import SwiftUI
import AppKit

private enum BoardLayout: String, CaseIterable {
    case matrix = "四象限"
    case list = "列表"
}

private extension Quadrant {
    var color: Color {
        switch self {
        case .importantUrgent: .red
        case .importantNotUrgent: .blue
        case .notImportantUrgent: .orange
        case .notImportantNotUrgent: .gray
        }
    }
}

struct DemandBoardView: View {
    @StateObject private var store = DemandStore()
    @StateObject private var drafts = EditorDraftStore()
    @State private var search = ""
    @State private var statusFilter = "active"
    @State private var editing: Demand?
    @AppStorage("boardLayout") private var layout = BoardLayout.matrix.rawValue

    private var visible: [Demand] {
        store.demands
            .filter { demand in
                let statusMatches: Bool
                switch statusFilter {
                case "active": statusMatches = demand.status != .completed
                case "all": statusMatches = true
                default: statusMatches = demand.status.rawValue == statusFilter
                }
                return statusMatches && demand.matches(search)
            }
            .sorted { $0.updatedAt > $1.updatedAt }
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider()
            filters
            if let error = drafts.errorMessage ?? store.errorMessage {
                Label(error, systemImage: "exclamationmark.triangle")
                    .font(.callout)
                    .foregroundStyle(.red)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 24)
                    .padding(.bottom, 8)
            }
            ScrollView {
                if layout == BoardLayout.matrix.rawValue {
                    matrix
                } else {
                    list
                }
            }
        }
        .frame(minWidth: 760, minHeight: 560)
        .sheet(item: $editing) { demand in
            DemandEditorView(demand: demand, store: store, drafts: drafts)
        }
    }

    private var header: some View {
        HStack(alignment: .center, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text("四象咒言").font(.system(size: 27, weight: .bold))
                Text("把需求放进四象限，为下一步写好咒言")
                    .font(.subheadline).foregroundStyle(.secondary)
            }
            Spacer()
            if !drafts.drafts.isEmpty {
                Menu("草稿（\(drafts.drafts.count)）") {
                    ForEach(drafts.drafts.keys.sorted(), id: \.self) { key in
                        if let saved = drafts.drafts[key] {
                            Button(saved.demand.title.isEmpty ? "未命名需求" : saved.demand.title) {
                                store.load()
                                drafts.load()
                                editing = saved.demand
                            }
                        }
                    }
                }
            }
            Button {
                store.load()
                drafts.load()
                editing = Demand()
            } label: {
                Label("新增需求", systemImage: "plus")
            }
            .buttonStyle(.borderedProminent)
            .keyboardShortcut("n", modifiers: .command)
        }
        .padding(.horizontal, 24)
        .padding(.vertical, 20)
    }

    private var filters: some View {
        HStack(spacing: 12) {
            TextField("搜索需求、项目或咒言", text: $search)
                .textFieldStyle(.roundedBorder)
                .frame(maxWidth: 320)
            Picker("状态", selection: $statusFilter) {
                Text("未完成").tag("active")
                Text("全部").tag("all")
                ForEach(DemandStatus.allCases) { status in
                    Text(status.title).tag(status.rawValue)
                }
            }
            .frame(width: 125)
            Spacer()
            Text("\(visible.count) 项")
                .font(.subheadline).foregroundStyle(.secondary)
            Picker("视图", selection: $layout) {
                ForEach(BoardLayout.allCases, id: \.rawValue) { option in
                    Text(option.rawValue).tag(option.rawValue)
                }
            }
            .pickerStyle(.segmented)
            .frame(width: 156)
        }
        .padding(.horizontal, 24)
        .padding(.vertical, 14)
    }

    private var matrix: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("重要程度 ↑")
                Spacer()
                Text("紧急程度 →")
            }
            .font(.caption)
            .foregroundStyle(.secondary)
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)],
                      alignment: .center, spacing: 12) {
                ForEach(Quadrant.rows.flatMap { $0 }) { quadrant in
                    QuadrantPanel(
                        quadrant: quadrant,
                        demands: visible.filter { $0.quadrant == quadrant },
                        store: store,
                        onEdit: { demand in store.load(); drafts.load(); editing = demand }
                    )
                }
            }
        }
        .padding(24)
    }

    private var list: some View {
        LazyVStack(spacing: 10) {
            if visible.isEmpty {
                ContentUnavailableView("暂无需求", systemImage: "square.stack",
                                       description: Text("点击“新增需求”开始整理你的想法。"))
                    .padding(.top, 90)
            }
            ForEach(visible) { demand in
                DemandCard(demand: demand, onEdit: { store.load(); drafts.load(); editing = demand })
            }
        }
        .padding(24)
    }
}

private struct QuadrantPanel: View {
    let quadrant: Quadrant
    let demands: [Demand]
    @ObservedObject var store: DemandStore
    let onEdit: (Demand) -> Void
    @State private var targeted = false

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Circle().fill(quadrant.color).frame(width: 8, height: 8)
                Text(quadrant.title).font(.headline)
                Spacer()
                Text("\(demands.count)")
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.secondary)
            }
            if demands.isEmpty {
                Text("拖入需求，或在编辑时选择此象限")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    LazyVStack(spacing: 8) {
                        ForEach(demands) { demand in
                            DemandCard(demand: demand, onEdit: { onEdit(demand) })
                                .draggable("dboard-open:\(demand.id.uuidString)")
                        }
                    }
                    .padding(.vertical, 2)
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, minHeight: 258, maxHeight: 258, alignment: .topLeading)
        .background(quadrant.color.opacity(targeted ? 0.12 : 0.045),
                    in: RoundedRectangle(cornerRadius: 12))
        .overlay {
            RoundedRectangle(cornerRadius: 12)
                .strokeBorder(quadrant.color.opacity(targeted ? 0.75 : 0.2),
                              lineWidth: targeted ? 2 : 1)
        }
        .dropDestination(for: String.self) { values, _ in
            guard let value = values.first,
                  value.hasPrefix("dboard-open:"),
                  let id = UUID(uuidString: String(value.dropFirst("dboard-open:".count))),
                  store.demands.contains(where: { $0.id == id }) else { return false }
            return store.move(id, to: quadrant)
        } isTargeted: { targeted = $0 }
        .accessibilityLabel("\(quadrant.title)，\(demands.count) 项")
    }
}

private struct DemandCard: View {
    let demand: Demand
    let onEdit: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Button(action: onEdit) {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text(demand.title)
                            .font(.system(size: 14, weight: .semibold))
                            .lineLimit(2)
                        Spacer()
                        Text(demand.status.title)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    if !demand.project.isEmpty {
                        Text(demand.project)
                            .font(.caption).foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                    if let dueDate = demand.dueDate {
                        Label(dueDate.formatted(date: .abbreviated, time: .omitted),
                              systemImage: "calendar")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                    if let latest = demand.progress.last {
                        Text(latest.text)
                            .font(.caption).foregroundStyle(.secondary)
                            .lineLimit(2)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            if !demand.spell.isEmpty {
                Button {
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(demand.spell.prompt(for: demand), forType: .string)
                } label: {
                    Image(systemName: "wand.and.stars")
                }
                .buttonStyle(.plain)
                .help("复制咒言")
                .accessibilityLabel("复制咒言：\(demand.title)")
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(nsColor: .controlBackgroundColor),
                    in: RoundedRectangle(cornerRadius: 9))
        .overlay {
            RoundedRectangle(cornerRadius: 9)
                .strokeBorder(Color(nsColor: .separatorColor).opacity(0.55))
        }
    }
}
