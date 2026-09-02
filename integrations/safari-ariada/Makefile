SHELL := /bin/bash

EXTENSION_PACKAGE := @ariada-org/extension-chrome
WEB_EXTENSION_DIR := ../../packages/extension-chrome/.output/chrome-mv3
PROJECT_DIR := build/AriadaSafari
PROJECT_FILE := $(PROJECT_DIR)/ariada/ariada.xcodeproj
SCHEME := ariada

.PHONY: test validate extension convert xcode-list xcode-build clean

test:
	node --test test/*.test.mjs

validate:
	node scripts/validate-config.mjs

extension:
	pnpm -F $(EXTENSION_PACKAGE) build

convert: extension
	bash scripts/convert.sh

xcode-list: convert
	xcodebuild -list -project "$(PROJECT_FILE)"

xcode-build: convert
	xcodebuild \
		-project "$(PROJECT_FILE)" \
		-scheme "$(SCHEME)" \
		-configuration Debug \
		-derivedDataPath DerivedData \
		CODE_SIGNING_ALLOWED=NO \
		build

clean:
	rm -rf build DerivedData ../../packages/extension-chrome/.output
