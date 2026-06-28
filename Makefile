# Copyright 2024 Ian Lewis
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

SHELL := /usr/bin/env bash -ueo pipefail
DEBUG_LOGGING ?= $(shell if [[ "$(GITHUB_ACTIONS)" == "true" ]] && [[ -n "$(RUNNER_DEBUG)" || "$(ACTIONS_RUNNER_DEBUG)" == "true" || "$(ACTIONS_STEP_DEBUG)" == "true" ]]; then echo "true"; else echo ""; fi)
BASH_OPTIONS := $(shell if [ "$(DEBUG_LOGGING)" == "true" ]; then echo "-x"; else echo ""; fi)

# Add extra options for debugging.
SHELL := /usr/bin/env bash -ueo pipefail $(BASH_OPTIONS)

uname_s := $(shell uname -s)
uname_m := $(shell uname -m)
arch.x86_64 := amd64
arch.aarch64 := arm64
arch.arm64 := arm64
arch := $(arch.$(uname_m))
kernel.Linux := linux
kernel.Darwin := darwin
kernel := $(kernel.$(uname_s))

OUTPUT_FORMAT ?= $(shell if [ "$(GITHUB_ACTIONS)" == "true" ]; then echo "github"; else echo ""; fi)
REPO_ROOT := $(shell dirname $(realpath $(firstword $(MAKEFILE_LIST))))
REPO_NAME := $(shell basename "$(REPO_ROOT)")

# renovate: datasource=github-releases depName=aquaproj/aqua versioning=loose
AQUA_VERSION ?= v2.60.1
AQUA_REPO := github.com/aquaproj/aqua
AQUA_CHECKSUM ?= $(AQUA_CHECKSUM.$(kernel).$(arch))
export AQUA_ROOT_DIR = $(REPO_ROOT)/.aqua

# Ensure that aqua and aqua installed tools are in the PATH.
export PATH := $(AQUA_ROOT_DIR)/bin:$(PATH)

# We want GNU versions of tools so prefer them if present.
GREP := $(shell command -v ggrep 2>/dev/null || command -v grep 2>/dev/null)
AWK := $(shell command -v gawk 2>/dev/null || command -v awk 2>/dev/null)
MKTEMP := $(shell command -v gmktemp 2>/dev/null || command -v mktemp 2>/dev/null)

# The help command prints targets in groups. Help documentation in the Makefile
# uses comments with double hash marks (##). Documentation is printed by the
# help target in the order in appears in the Makefile.
#
# Make targets can be documented with double hash marks as follows:
#
#	target-name: ## target documentation.
#
# Groups can be added with the following style:
#
#	## Group name

.PHONY: help
help: ## Print all Makefile targets (this message).
	@# bash \
	echo "$(REPO_NAME) Makefile"; \
	echo "Usage: $(MAKE) [COMMAND]"; \
	echo ""; \
	normal=""; \
	cyan=""; \
	if command -v tput >/dev/null 2>&1; then \
		if [ -t 1 ]; then \
			normal=$$(tput sgr0); \
			cyan=$$(tput setaf 6); \
		fi; \
	fi; \
	$(GREP) --no-filename -E '^([/a-z.A-Z0-9_%-]+:.*?|)##' $(MAKEFILE_LIST) | \
		$(AWK) \
			--assign=normal="$${normal}" \
			--assign=cyan="$${cyan}" \
			'BEGIN {FS = "(:.*?|)## ?"}; { \
				if (length($$1) > 0) { \
					printf("  " cyan "%-25s" normal " %s\n", $$1, $$2); \
				} else { \
					if (length($$2) > 0) { \
						printf("%s\n", $$2); \
					} \
				} \
			}'

# Node.js setup
#####################################################################

package-lock.json: package.json $(AQUA_ROOT_DIR)/.installed
	@# bash \
	loglevel="notice"; \
	if [ -n "$(DEBUG_LOGGING)" ]; then \
		loglevel="verbose"; \
	fi; \
	# NOTE: npm install will happily ignore the fact that integrity hashes are \
	# missing in the package-lock.json. We need to check for missing integrity \
	# fields ourselves. If any are missing, then we need to regenerate the \
	# package-lock.json from scratch. \
	nointegrity=""; \
	noresolved=""; \
	if [ -f "$@" ]; then \
		nointegrity=$$(jq '.packages | del(."") | .[] | select(has("integrity") | not)' < $@); \
		noresolved=$$(jq '.packages | del(."") | .[] | select(has("resolved") | not)' < $@); \
	fi; \
	if [ ! -f "$@" ] || [ -n "$${nointegrity}" ] || [ -n "$${noresolved}" ]; then \
		# NOTE: package-lock.json is removed to ensure that npm includes the \
		# integrity field. npm install will not restore this field if \
		# missing in an existing package-lock.json file. \
		rm -f $@; \
		# NOTE: We clean the node_modules directory to ensure that npm install \
		#       will not desync between the package.json, package-lock.json \
		#       and the node_modules directory. \
		$(MAKE) clean-node-modules; \
		npm --loglevel="$${loglevel}" install \
			--no-audit \
			--no-fund; \
	else \
		npm --loglevel="$${loglevel}" install \
			--package-lock-only \
			--no-audit \
			--no-fund; \
	fi

node_modules/.installed: package.json
	@# bash \
	loglevel="silent"; \
	if [ -n "$(DEBUG_LOGGING)" ]; then \
		loglevel="verbose"; \
	fi; \
	npm --loglevel="$${loglevel}" clean-install; \
	npm --loglevel="$${loglevel}" audit signatures; \
	touch $@

# Python setup
#####################################################################

.uv/venv/bin/activate:
	@# bash \
	mkdir -p .uv; \
	python -m venv .uv/venv; \
	touch $@

.uv/.installed: requirements-dev.txt .uv/venv/bin/activate
	@# bash \
	./.uv/venv/bin/pip install -r $< --require-hashes; \
	touch $@

uv.lock: pyproject.toml .uv/.installed
	@# bash \
	./.uv/venv/bin/uv lock; \
	touch $@

.venv/.installed: pyproject.toml .uv/.installed
	@# bash \
	./.uv/venv/bin/uv sync --locked; \
	touch $@

# Aqua setup
#####################################################################

$(AQUA_ROOT_DIR)/.$(AQUA_VERSION).installed:
	@# bash \
	./third_party/aquaproj/aqua-installer/aqua-installer -v "$(AQUA_VERSION)"; \
	touch $@

.aqua-checksums.json: .aqua.yaml $(AQUA_ROOT_DIR)/.$(AQUA_VERSION).installed
	@# bash \
	loglevel="info"; \
	if [ -n "$(DEBUG_LOGGING)" ]; then \
		loglevel="debug"; \
	fi; \
	$(AQUA_ROOT_DIR)/bin/aqua \
		--config ".aqua.yaml" \
		--log-level "$${loglevel}" \
		update-checksum \
		--prune

$(AQUA_ROOT_DIR)/.installed: .aqua.yaml $(AQUA_ROOT_DIR)/.$(AQUA_VERSION).installed
	@# bash \
	loglevel="info"; \
	if [ -n "$(DEBUG_LOGGING)" ]; then \
		loglevel="debug"; \
	fi; \
	$(AQUA_ROOT_DIR)/bin/aqua \
		--config ".aqua.yaml" \
		--log-level "$${loglevel}" \
		install; \
	touch $@

## Build
#####################################################################

.PHONY: all
all: test pack ## Build everything.

.PHONY: build
build: node_modules/.installed ## Build the project.
	@# bash \
	rm -rf lib; \
	./node_modules/.bin/tsc

.PHONY: package
package: build ## Builds the distribution package.
	@# bash \
	rm -rf dist; \
	npx rollup --config rollup.config.ts --configPlugin @rollup/plugin-typescript

## Testing
#####################################################################

.PHONY: test
test: lint unit-test ## Run all tests.

.PHONY: unit-test
unit-test: build ## Runs all unit tests.
	@# bash \
	# NOTE: Make sure the package builds. \
	NODE_OPTIONS=--experimental-vm-modules \
	NODE_NO_WARNINGS=1 \
		./node_modules/.bin/jest --coverage

## Formatting
#####################################################################

.PHONY: format
format: js-format json-format license-headers md-format ts-format yaml-format ## Format all files

.PHONY: js-format
js-format: node_modules/.installed ## Format YAML files.
	@# bash \
	loglevel="log"; \
	if [ -n "$(DEBUG_LOGGING)" ]; then \
		loglevel="debug"; \
	fi; \
	files=$$( \
		git ls-files --deduplicate \
			'*.js' \
			'*.cjs' \
			'*.mjs' \
			'*.jsx' \
			'*.mjsx' \
			':!:dist/' \
	); \
	if [ "$${files}" == "" ]; then \
		exit 0; \
	fi; \
	./node_modules/.bin/prettier \
		--log-level "$${loglevel}" \
		--no-error-on-unmatched-pattern \
		--write \
		$${files}

.PHONY: json-format
json-format: node_modules/.installed ## Format JSON files.
	@# bash \
	loglevel="log"; \
	if [ -n "$(DEBUG_LOGGING)" ]; then \
		loglevel="debug"; \
	fi; \
	files=$$( \
		git ls-files --deduplicate \
			'*.json' \
			'*.json5' \
			| while IFS='' read -r f; do [ -f "$${f}" ] && echo "$${f}" || true; done \
	); \
	if [ "$${files}" == "" ]; then \
		exit 0; \
	fi; \
	./node_modules/.bin/prettier \
		--log-level "$${loglevel}" \
		--no-error-on-unmatched-pattern \
		--write \
		$${files}

.PHONY: license-headers
license-headers: ## Update license headers.
	@# bash \
	files=$$( \
		git ls-files --deduplicate \
			'*.c' \
			'*.cpp' \
			'*.go' \
			'*.h' \
			'*.hpp' \
			'*.js' \
			'*.lua' \
			'*.py' \
			'*.rb' \
			'*.rs' \
			'*.yaml' \
			'*.yml' \
			'Makefile' \
			':!:dist/' \
			| while IFS='' read -r f; do [ -f "$${f}" ] && echo "$${f}" || true; done \
	); \
	name=$$(git config user.name); \
	if [ "$${name}" == "" ]; then \
		>&2 echo "git user.name is required."; \
		>&2 echo "Set it up using:"; \
		>&2 echo "git config user.name \"John Doe\""; \
		exit 1; \
	fi; \
	for filename in $${files}; do \
		if ! ( head "$${filename}" | $(GREP) -iL "Copyright" > /dev/null ); then \
			./third_party/mbrukman/autogen/autogen.sh \
				--in-place \
				--no-code \
				--no-tlc \
				--copyright "$${name}" \
				--license apache \
				"$${filename}"; \
		fi; \
	done

.PHONY: md-format
md-format: node_modules/.installed ## Format Markdown files.
	@# bash \
	loglevel="log"; \
	if [ -n "$(DEBUG_LOGGING)" ]; then \
		loglevel="debug"; \
	fi; \
	files=$$( \
		git ls-files --deduplicate \
			'*.md' \
			| while IFS='' read -r f; do [ -f "$${f}" ] && echo "$${f}" || true; done \
	); \
	if [ "$${files}" == "" ]; then \
		exit 0; \
	fi; \
	# NOTE: prettier uses .editorconfig for tab-width. \
	./node_modules/.bin/prettier \
		--log-level "$${loglevel}" \
		--no-error-on-unmatched-pattern \
		--write \
		$${files}

.PHONY: yaml-format
yaml-format: node_modules/.installed ## Format YAML files.
	@# bash \
	loglevel="log"; \
	if [ -n "$(DEBUG_LOGGING)" ]; then \
		loglevel="debug"; \
	fi; \
	files=$$( \
		git ls-files --deduplicate \
			'*.yml' \
			'*.yaml' \
	); \
	if [ "$${files}" == "" ]; then \
		exit 0; \
	fi; \
	./node_modules/.bin/prettier \
		--log-level "$${loglevel}" \
		--no-error-on-unmatched-pattern \
		--write \
		$${files}

.PHONY: ts-format
ts-format: node_modules/.installed ## Format YAML files.
	@# bash \
	loglevel="log"; \
	if [ -n "$(DEBUG_LOGGING)" ]; then \
		loglevel="debug"; \
	fi; \
	files=$$( \
		git ls-files --deduplicate \
			'*.ts' \
			'*.cts' \
			'*.mts' \
			'*.tsx' \
			'*.mtsx' \
			':!:dist/' \
	);  \
	if [ "$${files}" == "" ]; then \
		exit 0; \
	fi; \
	./node_modules/.bin/prettier \
		--log-level "$${loglevel}" \
		--no-error-on-unmatched-pattern \
		--write \
		$${files}

## Linting
#####################################################################

.PHONY: lint
lint: actionlint checkmake commitlint eslint fixme format-check markdownlint renovate-config-validator textlint yamllint zizmor ## Run all linters.

.PHONY: actionlint
actionlint: $(AQUA_ROOT_DIR)/.installed ## Runs the actionlint linter.
	@# bash \
	# NOTE: We need to ignore config files used in tests. \
	files=$$( \
		git ls-files --deduplicate \
			'.github/workflows/*.yml' \
			'.github/workflows/*.yaml' \
			| while IFS='' read -r f; do [ -f "$${f}" ] && echo "$${f}" || true; done \
	); \
	if [ "$${files}" == "" ]; then \
		exit 0; \
	fi; \
	if [ "$(OUTPUT_FORMAT)" == "github" ]; then \
		actionlint \
			-format '{{range $$err := .}}::error file={{$$err.Filepath}},line={{$$err.Line}},col={{$$err.Column}}::{{$$err.Message}}%0A```%0A{{replace $$err.Snippet "\\n" "%0A"}}%0A```\n{{end}}' \
			-ignore 'SC2016:' \
			$${files}; \
	else \
		actionlint \
			-ignore 'SC2016:' \
			$${files}; \
	fi

.PHONY: checkmake
checkmake: $(AQUA_ROOT_DIR)/.installed ## Runs the checkmake linter.
	@# bash \
	# NOTE: We need to ignore config files used in tests. \
	files=$$( \
		git ls-files --deduplicate \
			'Makefile' \
			| while IFS='' read -r f; do [ -f "$${f}" ] && echo "$${f}" || true; done \
	); \
	if [ "$${files}" == "" ]; then \
		exit 0; \
	fi; \
	if [ "$(OUTPUT_FORMAT)" == "github" ]; then \
		checkmake \
			--format '::error file={{.FileName}},line={{.LineNumber}}::{{.Rule}}: {{.Violation}}' \
			$${files}; \
	else \
		checkmake $${files}; \
	fi

.PHONY: commitlint
commitlint: node_modules/.installed ## Run commitlint linter.
	@# bash \
	commitlint_from=$(COMMITLINT_FROM_REF); \
	commitlint_to=$(COMMITLINT_TO_REF); \
	if [ "$${commitlint_from}" == "" ]; then \
		# Try to get the default branch without hitting the remote server \
		if git symbolic-ref --short refs/remotes/origin/HEAD >/dev/null 2>&1; then \
			commitlint_from=$$(git symbolic-ref --short refs/remotes/origin/HEAD); \
		elif git show-ref refs/remotes/origin/master >/dev/null 2>&1; then \
			commitlint_from="origin/master"; \
		else \
			commitlint_from="origin/main"; \
		fi; \
	fi; \
	if [ "$${commitlint_to}" == "" ]; then \
		# If upstream of HEAD is on the commitlint_from branch, then we will \
		# lint the last commit by default. \
		current_branch=$$(git rev-parse --abbrev-ref @{u}); \
		if [ "$${commitlint_from}" == "$${current_branch}" ]; then \
			commitlint_from="HEAD~1"; \
		fi; \
		commitlint_to="HEAD"; \
	fi; \
	./node_modules/.bin/commitlint \
		--from "$${commitlint_from}" \
		--to "$${commitlint_to}" \
		--verbose \
		--strict

.PHONY: eslint
eslint: node_modules/.installed ## Runs eslint.
	@# bash \
	extraargs=""; \
	if [ -n "$(DEBUG_LOGGING)" ]; then \
		extraargs="--debug"; \
	fi; \
	files=$$( \
		git ls-files --deduplicate \
			'*.js' \
			'*.cjs' \
			'*.mjs' \
			'*.jsx' \
			'*.mjsx' \
			'*.ts' \
			'*.cts' \
			'*.mts' \
			'*.tsx' \
			'*.mtsx' \
			':!:dist/' \
			| while IFS='' read -r f; do [ -f "$${f}" ] && echo "$${f}" || true; done \
	); \
	if [ "$${files}" == "" ]; then \
		exit 0; \
	fi; \
	if [ "$(OUTPUT_FORMAT)" == "github" ]; then \
		exit_code=0; \
		while IFS="" read -r p && [ -n "$${p}" ]; do \
			file=$$(echo "$${p}" | jq -c '.filePath // empty' | tr -d '"'); \
			while IFS="" read -r m && [ -n "$${m}" ]; do \
				severity=$$(echo "$${m}" | jq -c '.severity // empty' | tr -d '"'); \
				line=$$(echo "$${m}" | jq -c '.line // empty' | tr -d '"'); \
				endline=$$(echo "$${m}" | jq -c '.endLine // empty' | tr -d '"'); \
				col=$$(echo "$${m}" | jq -c '.column // empty' | tr -d '"'); \
				endcol=$$(echo "$${m}" | jq -c '.endColumn // empty' | tr -d '"'); \
				message=$$(echo "$${m}" | jq -c '.message // empty' | tr -d '"'); \
				exit_code=1; \
				case $${severity} in \
				"1") \
					echo "::warning file=$${file},line=$${line},endLine=$${endline},col=$${col},endColumn=$${endcol}::$${message}"; \
					;; \
				"2") \
					echo "::error file=$${file},line=$${line},endLine=$${endline},col=$${col},endColumn=$${endcol}::$${message}"; \
					;; \
				esac; \
			done <<<$$(echo "$${p}" | jq -c '.messages[]'); \
		done <<<$$(./node_modules/.bin/eslint \
			--max-warnings 0 \
			--format json \
			$${extraargs} \
			$${files} | jq -c '.[]'); \
		exit "$${exit_code}"; \
	else \
		./node_modules/.bin/eslint \
			--max-warnings 0 \
			$${extraargs} \
			$${files}; \
	fi

.PHONY: fixme
fixme: $(AQUA_ROOT_DIR)/.installed ## Check for outstanding FIXMEs.
	@# bash \
	output="default"; \
	if [ "$(OUTPUT_FORMAT)" == "github" ]; then \
		output="github"; \
	fi; \
	# NOTE: todos does not use `git ls-files` because many files might be \
	# 		unsupported and generate an error if passed directly on the \
	# 		command line. \
	todos \
		--output "$${output}" \
		--todo-types="FIXME,Fixme,fixme,BUG,Bug,bug,XXX,COMBAK"

.PHONY: format-check
format-check: ## Check that files are properly formatted.
	@# bash \
	if [ -n "$$(git diff)" ]; then \
		>&2 echo "The working directory is dirty. Please commit, stage, or stash changes and try again."; \
		exit 1; \
	fi; \
	$(MAKE) format; \
	exit_code=0; \
	if [ -n "$$(git diff)" ]; then \
		>&2 echo "Some files need to be formatted. Please run '$(MAKE) format' and try again."; \
		if [ "$(OUTPUT_FORMAT)" == "github" ]; then \
			echo "::group::git diff"; \
		fi; \
		git --no-pager diff; \
		if [ "$(OUTPUT_FORMAT)" == "github" ]; then \
			echo "::endgroup::"; \
		fi; \
		exit_code=1; \
	fi; \
	git restore .; \
	exit "$${exit_code}"

.PHONY: markdownlint
markdownlint: node_modules/.installed $(AQUA_ROOT_DIR)/.installed ## Runs the markdownlint linter.
	@# bash \
	# NOTE: Issue and PR templates are handled specially so we can disable \
	# MD041/first-line-heading/first-line-h1 without adding an ugly html comment \
	# at the top of the file. \
	files=$$( \
		git ls-files --deduplicate \
			'*.md' \
			| while IFS='' read -r f; do [ -f "$${f}" ] && echo "$${f}" || true; done \
	); \
	if [ "$${files}" == "" ]; then \
		exit 0; \
	fi; \
	./node_modules/.bin/markdownlint-cli2 $${files}

.PHONY: renovate-config-validator
renovate-config-validator: node_modules/.installed ## Validate Renovate configuration.
	@# bash \
	./node_modules/.bin/renovate-config-validator \
		--strict

.PHONY: textlint
textlint: node_modules/.installed $(AQUA_ROOT_DIR)/.installed ## Runs the textlint linter.
	@# bash \
	files=$$( \
		git ls-files --deduplicate \
			'*.md' \
			'*.txt' \
			':!:requirements*.txt' \
			| while IFS='' read -r f; do [ -f "$${f}" ] && echo "$${f}" || true; done \
	); \
	if [ "$${files}" == "" ]; then \
		exit 0; \
	fi; \
	./node_modules/.bin/textlint $${files}

.PHONY: yamllint
yamllint: .venv/.installed ## Runs the yamllint linter.
	@# bash \
	files=$$( \
		git ls-files --deduplicate \
			'*.yml' \
			'*.yaml' \
			| while IFS='' read -r f; do [ -f "$${f}" ] && echo "$${f}" || true; done \
	); \
	if [ "$${files}" == "" ]; then \
		exit 0; \
	fi; \
	format="standard"; \
	if [ "$(OUTPUT_FORMAT)" == "github" ]; then \
		format="github"; \
	fi; \
	./.venv/bin/yamllint \
		--strict \
		--format "$${format}" \
		$${files}

.PHONY: zizmor
zizmor: .venv/.installed ## Runs the zizmor linter.
	@# bash \
	# NOTE: On GitHub actions this outputs SARIF format to zizmor.sarif.json \
	#       in addition to outputting errors to the terminal. \
	files=$$( \
		git ls-files --deduplicate \
			'.github/workflows/*.yml' \
			'.github/workflows/*.yaml' \
			| while IFS='' read -r f; do [ -f "$${f}" ] && echo "$${f}" || true; done \
	); \
	if [ "$${files}" == "" ]; then \
		exit 0; \
	fi; \
	if [ "$(OUTPUT_FORMAT)" == "github" ]; then \
		./.venv/bin/zizmor \
			--quiet \
			--pedantic \
			--format sarif \
			$${files} > zizmor.sarif.json; \
	fi; \
	./.venv/bin/zizmor \
		--quiet \
		--pedantic \
		--format plain \
		$${files}

## Maintenance
#####################################################################

.PHONY: update-lockfiles
update-lockfiles: .aqua-checksums.json package-lock.json uv.lock ## Update lockfiles.

.PHONY: todos
todos: $(AQUA_ROOT_DIR)/.installed ## Print outstanding TODOs.
	@# bash \
	output="default"; \
	if [ "$(OUTPUT_FORMAT)" == "github" ]; then \
		output="github"; \
	fi; \
	# NOTE: todos does not use `git ls-files` because many files might be \
	# 		unsupported and generate an error if passed directly on the \
	# 		command line. \
	todos \
		--output "$${output}" \
		--todo-types="TODO,Todo,todo,FIXME,Fixme,fixme,BUG,Bug,bug,XXX,COMBAK"

.PHONY: clean-node-modules
clean-node-modules:
	@$(RM) -r node_modules

.PHONY: clean
clean: clean-node-modules ## Delete temporary files.
	@$(RM) -r .bin
	@$(RM) -r $(AQUA_ROOT_DIR)
	@$(RM) -r .venv
	@$(RM) -r .uv
	@$(RM) *.sarif.json
	@$(RM) -r lib
	@$(RM) -r coverage
