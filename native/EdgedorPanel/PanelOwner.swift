import AppKit

@MainActor
final class PanelOwner {
    private var panel: NSPanel?

    func show() {
        if panel == nil {
            let panel = NSPanel(contentRect: .zero, styleMask: [.titled, .fullSizeContentView], backing: .buffered, defer: true)
            panel.isFloatingPanel = true
            panel.hidesOnDeactivate = false
            self.panel = panel
        }
        panel?.orderFrontRegardless()
        panel?.makeKeyAndOrderFront(nil)
    }

    func hide() { panel?.orderOut(nil) }
    func focus() { panel?.makeKeyAndOrderFront(nil) }
}
