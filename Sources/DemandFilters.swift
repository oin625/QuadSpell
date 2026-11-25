import SwiftUI

enum DemandFilter: String, CaseIterable, Identifiable {
    case all = "全部", urgent = "紧急", inProgress = "进行中", pending = "待开始", suspended = "挂起", completed = "已完成", incidents = "排查"
    var id: String { rawValue }
    func includes(_ item: DItem) -> Bool {
        switch self {
        case .incidents: return item.isIncident
        case .all: return true
        case .urgent: return item.isUrgent
        case .inProgress: return item.status == .inProgress
        case .pending: return item.status == .pending
        case .suspended: return item.status == .suspended
        case .completed: return item.status == .completed
        }
    }
}

extension DBoardViewModel {
    var filteredItems: [DItem] {
        items.filter { demandFilter.includes($0) && DemandSearch.matches($0, query: demandQuery) }
    }

    var isDefaultDemandList: Bool { demandFilter == .all && demandQuery.trimmed.isEmpty }

    var visibleOpenDemands: [DItem] {
        let isDefault = isDefaultDemandList
        let matches = filteredItems.filter { isDefault ? $0.status == .inProgress : $0.status != .completed }
        let now = Date()
        let dated: [(item: DItem, updated: Date)] = matches.map { item in
            let activity = DemandDates.recordedActivity(item, on: now)
            let plan = DemandDates.timestamp(item.technicalPlan?.updatedAt)
            let change = item.changes.map(\.createdAt).max()
            let updated = [activity, plan, change].compactMap { $0 }.max()
            return (item, updated ?? .distantPast)
        }
        return dated.sorted { $0.updated > $1.updated }.map(\.item)
    }

    var filteredArchiveRecords: [ArchivedDemand] {
        DemandArchiveCatalog.visible(demandArchives.records, active: items, filter: demandFilter, query: demandQuery)
    }

    var filteredDemandCount: Int { filteredItems.count + filteredArchiveRecords.count }
    var knownDemandCount: Int { Set(items.map(\.id) + demandArchives.records.map { $0.item.id }).count }

    func showDemands(_ filter: DemandFilter = .all) {
        if [.all, .completed, .incidents].contains(filter) { demandArchives.reloadLocal() }
        demandFilter = filter; demandQuery = ""; selectedID = nil; workspacePage = .demands
    }
}

struct DemandFilterBar: View {
    @EnvironmentObject var vm: DBoardViewModel
    @ObservedObject var store: DemandArchiveStore
    var body: some View {
        HStack(spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass").dboardFont(size: 12).foregroundStyle(.secondary)
                TextField("搜索任务、项目或进度", text: $vm.demandQuery)
                    .dboardFont(size: 12).textFieldStyle(.plain).accessibilityLabel("搜索本地任务")
                if !vm.demandQuery.isEmpty {
                    Button { vm.demandQuery = "" } label: {
                        Image(systemName: "xmark.circle.fill").foregroundStyle(.tertiary)
                    }.buttonStyle(DBoardPlainButtonStyle()).accessibilityLabel("清除搜索")
                }
            }
            .padding(.horizontal, 10).frame(height: 34)
            .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(Color.primary.opacity(0.06), lineWidth: 0.5))
            Picker("任务筛选", selection: $vm.demandFilter) {
                ForEach(DemandFilter.allCases) { Text($0.rawValue).tag($0) }
            }.labelsHidden().frame(width: 104).controlSize(.regular)
            if vm.demandFilter != .all {
                Button { vm.demandFilter = .all; vm.demandQuery = "" } label: {
                    Image(systemName: "line.3.horizontal.decrease.circle").dboardFont(size: 14)
                }.buttonStyle(DBoardPlainButtonStyle()).foregroundStyle(.secondary).accessibilityLabel("清除筛选")
            }
        }.padding(.horizontal, 20).padding(.top, 16).padding(.bottom, 12)
    }
}
