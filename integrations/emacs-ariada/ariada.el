;;; ariada.el --- Run Ariada accessibility scans -*- lexical-binding: t; -*-

;; Copyright (C) 2026 Ariada
;; Author: Ariada maintainers <git@ariada.org>
;; Version: 0.1.0
;; Package-Requires: ((emacs "29.1"))
;; Keywords: tools, accessibility
;; URL: https://ariada.org

;;; Commentary:

;; Thin Emacs wrapper around the external Ariada CLI.  The scanner remains in
;; `ariada scan`; this package only starts the process and displays output.

;;; Code:

(defgroup ariada nil
  "Run Ariada accessibility scans."
  :group 'tools)

(defcustom ariada-cli-command "ariada"
  "Executable used for Ariada scans."
  :type 'string
  :group 'ariada)

(defcustom ariada-default-target "http://localhost:3000"
  "Default URL used when `ariada-scan' is called without a prefix argument."
  :type 'string
  :group 'ariada)

(defun ariada--scan-command (target)
  "Build the Ariada CLI command for TARGET."
  (list ariada-cli-command "scan" target "--format" "json"))

(defun ariada--compilation-line (finding)
  "Format FINDING as a compilation-style line."
  (let-alist finding
    (format "%s:%s:%s: %s [%s]"
            (or .file "scan")
            (or .line 1)
            (or .column 1)
            (or .description "")
            (or .id "ariada"))))

;;;###autoload
(defun ariada-scan (target)
  "Run Ariada scan against TARGET and show CLI output."
  (interactive (list (read-string "Ariada target: " ariada-default-target)))
  (let* ((buffer (get-buffer-create "*ariada scan*"))
         (args (cdr (ariada--scan-command target))))
    (with-current-buffer buffer
      (erase-buffer)
      (compilation-mode))
    (apply #'start-process "ariada-scan" buffer ariada-cli-command args)
    (pop-to-buffer buffer)))

(provide 'ariada)

;;; ariada.el ends here
