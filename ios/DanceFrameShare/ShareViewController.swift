import UIKit
import UniformTypeIdentifiers

class ShareViewController: UIViewController {

  private let appGroupID = "group.danceframe.shared"
  private let pendingFilename = "pending_import.mp4"
  private let appURLScheme = "danceframe://import-ready"

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = UIColor.black.withAlphaComponent(0.6)
    let spinner = UIActivityIndicatorView(style: .large)
    spinner.color = UIColor(red: 0.12, green: 0.87, blue: 0.79, alpha: 1)
    spinner.center = view.center
    spinner.startAnimating()
    view.addSubview(spinner)
  }

  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    processVideo()
  }

  private func processVideo() {
    guard let items = extensionContext?.inputItems as? [NSExtensionItem] else {
      finish()
      return
    }

    for item in items {
      for provider in (item.attachments ?? []) {
        let videoUTI = "public.movie"
        if provider.hasItemConformingToTypeIdentifier(videoUTI) {
          provider.loadFileRepresentation(forTypeIdentifier: videoUTI) { [weak self] url, error in
            guard let self = self, let url = url, error == nil else {
              self?.finish()
              return
            }
            self.copyToGroupContainer(from: url)
          }
          return
        }
      }
    }
    finish()
  }

  private func copyToGroupContainer(from sourceURL: URL) {
    guard let containerURL = FileManager.default.containerURL(
      forSecurityApplicationGroupIdentifier: appGroupID
    ) else {
      finish()
      return
    }

    let destURL = containerURL.appendingPathComponent(pendingFilename)
    let fm = FileManager.default
    try? fm.removeItem(at: destURL)
    do {
      try fm.copyItem(at: sourceURL, to: destURL)
    } catch {
      finish()
      return
    }

    openMainApp()
    finish()
  }

  private func openMainApp() {
    guard let url = URL(string: appURLScheme) else { return }
    // UIResponder chain trick — only reliable way to open URLs from a Share Extension on iOS 15+
    let openSel = NSSelectorFromString("openURL:")
    var responder: UIResponder? = self
    while let r = responder {
      if r.responds(to: openSel) {
        r.perform(openSel, with: url)
        break
      }
      responder = r.next
    }
  }

  private func finish() {
    DispatchQueue.main.async {
      self.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
    }
  }
}
