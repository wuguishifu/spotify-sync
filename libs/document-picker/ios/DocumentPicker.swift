import UIKit
import NitroModules

// UIDocumentPickerViewController(forExporting:) is the only sanctioned way to move a
// file from our app's sandbox into another app's Files-exposed folder (e.g. Spotify's
// "On My iPhone > Spotify"). There is no silent/background API for this — the user must
// pick the destination folder themselves, but they can do it once for a whole batch.
class DocumentPicker: HybridDocumentPickerSpec {
  // Keep a strong reference to the delegate for the lifetime of the picker
  // presentation, otherwise it gets deallocated before the callback fires.
  private var activeDelegate: ExportPickerDelegate?

  func exportFilesToApp(fileUris: [String]) throws -> Promise<[String]> {
    let promise = Promise<[String]>()

    DispatchQueue.main.async {
      let urls = fileUris.compactMap { URL(string: $0) }

      guard !urls.isEmpty else {
        promise.reject(withError: RuntimeError.error(withMessage: "No valid file URIs were provided"))
        return
      }

      guard let presenter = DocumentPicker.topViewController() else {
        promise.reject(withError: RuntimeError.error(withMessage: "Could not find a view controller to present from"))
        return
      }

      // asCopy: true means the source file is left untouched in our sandbox;
      // the OS copies it to wherever the user picks. Use false if you want
      // a move instead (fine for our case since these are staged temp files).
      let picker = UIDocumentPickerViewController(forExporting: urls, asCopy: true)

      let delegate = ExportPickerDelegate { [weak self] result in
        self?.activeDelegate = nil
        switch result {
        case .success(let savedUrls):
          promise.resolve(withResult: savedUrls.map { $0.absoluteString })
        case .cancelled:
          promise.reject(withError: RuntimeError.error(withMessage: "User cancelled the export"))
        }
      }
      self.activeDelegate = delegate
      picker.delegate = delegate

      presenter.present(picker, animated: true)
    }

    return promise
  }

  private static func topViewController(
    _ base: UIViewController? = UIApplication.shared.connectedScenes
      .compactMap { ($0 as? UIWindowScene)?.keyWindow }
      .first?.rootViewController
  ) -> UIViewController? {
    if let nav = base as? UINavigationController {
      return topViewController(nav.visibleViewController)
    }
    if let tab = base as? UITabBarController, let selected = tab.selectedViewController {
      return topViewController(selected)
    }
    if let presented = base?.presentedViewController {
      return topViewController(presented)
    }
    return base
  }
}

private enum ExportResult {
  case success([URL])
  case cancelled
}

private class ExportPickerDelegate: NSObject, UIDocumentPickerDelegate {
  private let completion: (ExportResult) -> Void

  init(completion: @escaping (ExportResult) -> Void) {
    self.completion = completion
  }

  func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
    completion(.success(urls))
  }

  func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
    completion(.cancelled)
  }
}
