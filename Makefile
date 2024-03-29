# Copyright 2023 Google LLC
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

SHELL := /bin/bash
OUTPUT_FORMAT ?= $(shell if [ "${GITHUB_ACTIONS}" == "true" ]; then echo "github"; else echo ""; fi)
REPO_NAME = $(shell basename "$$(pwd)")

.PHONY: help
help: ## Shows all targets and help from the Makefile (this message).
	@echo "$(REPO_NAME) Makefile"
	@echo "Usage: make [COMMAND]"
	@echo ""
	@grep --no-filename -E '^([/a-z.A-Z0-9_%-]+:.*?|)##' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = "(:.*?|)## ?"}; { \
			if (length($$1) > 0) { \
				printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2; \
			} else { \
				if (length($$2) > 0) { \
					printf "%s\n", $$2; \
				} \
			} \
		}'

package-lock.json:
	npm install

.PHONY: action
action: node_modules/.installed ## Builds the action.
	rm -rf lib
	npm run build

.PHONY: package
package: action ## Builds the distribution package.
	rm -rf dist
	npm run package

.PHONY: clean
clean: ## Deletes generated files.
	# NOTE: dist is checked in so it's not deleted.
	rm -rf lib node_modules coverage

node_modules/.installed: package.json package-lock.json
	npm ci
	touch node_modules/.installed

## Tools
#####################################################################

.PHONY: autogen
autogen: ## Runs autogen on code files.
	@set -euo pipefail; \
		md_files=$$( \
			find . -type f \
				\( \
					-name '*.go' -o \
					-name '*.yaml' -o \
					-name '*.yml' \
				\) \
				-not -iwholename '*/.git/*' \
				-not -iwholename '*/vendor/*' \
				-not -iwholename '*/node_modules/*' \
		); \
		for filename in $${md_files}; do \
			if ! ( head "$${filename}" | grep -iL "Copyright" > /dev/null ); then \
				autogen -i --no-code --no-tlc -c "Google LLC" -l apache "$${filename}"; \
			fi; \
		done; \
		if ! ( head Makefile | grep -iL "Copyright" > /dev/null ); then \
			autogen -i --no-code --no-tlc -c "Google LLC" -l apache Makefile; \
		fi;

.PHONY: format
format: md-format yaml-format ## Format all files

.PHONY: md-format
md-format: node_modules/.installed ## Format Markdown files.
	@set -euo pipefail; \
		files=$$( \
			find . -type f \
				\( \
					-name '*.md' -o \
					-name '*.markdown' \
				\) \
				-not -iwholename '*/.git/*' \
				-not -iwholename '*/vendor/*' \
				-not -iwholename '*/node_modules/*' \
		); \
		./node_modules/.bin/prettier --write $${files}

.PHONY: yaml-format
yaml-format: node_modules/.installed ## Format YAML files.
	@set -euo pipefail; \
		files=$$( \
			find . -type f \
				\( \
					-name '*.yaml' -o \
					-name '*.yml' \
				\) \
				-not -iwholename '*/.git/*' \
				-not -iwholename '*/vendor/*' \
				-not -iwholename '*/node_modules/*' \
		); \
		./node_modules/.bin/prettier --write $${files}

## Testing
#####################################################################

.PHONY: unit-test
unit-test: node_modules/.installed ## Runs all unit tests.
	# NOTE: Make sure the package builds.
	npm run build
	npm run test

## Linters
#####################################################################

.PHONY: lint
lint: yamllint actionlint markdownlint eslint ## Run all linters.

.PHONY: actionlint
actionlint: ## Runs the actionlint linter.
	@# NOTE: We need to ignore config files used in tests.
	@set -euo pipefail; \
		files=$$( \
			find .github/workflows/ -type f \
				\( \
					-name '*.yaml' -o \
					-name '*.yml' \
				\) \
		); \
		if [ "$(OUTPUT_FORMAT)" == "github" ]; then \
			actionlint -format '{{range $$err := .}}::error file={{$$err.Filepath}},line={{$$err.Line}},col={{$$err.Column}}::{{$$err.Message}}%0A```%0A{{replace $$err.Snippet "\\n" "%0A"}}%0A```\n{{end}}' -ignore 'SC2016:' $${files}; \
		else \
			actionlint $${files}; \
		fi

.PHONY: markdownlint
markdownlint: node_modules/.installed ## Runs the markdownlint linter.
	@set -euo pipefail; \
		if [ "$(OUTPUT_FORMAT)" == "github" ]; then \
			exit_code=0; \
			while IFS="" read -r p && [ -n "$$p" ]; do \
				file=$$(echo "$$p" | jq -c -r '.fileName // empty'); \
				line=$$(echo "$$p" | jq -c -r '.lineNumber // empty'); \
				endline=$${line}; \
				message=$$(echo "$$p" | jq -c -r '.ruleNames[0] + "/" + .ruleNames[1] + " " + .ruleDescription + " [Detail: \"" + .errorDetail + "\", Context: \"" + .errorContext + "\"]"'); \
				exit_code=1; \
				echo "::error file=$${file},line=$${line},endLine=$${endline}::$${message}"; \
			done <<< "$$(./node_modules/.bin/markdownlint --dot --json . 2>&1 | jq -c '.[]')"; \
			exit "$${exit_code}"; \
		else \
			./node_modules/.bin/markdownlint --dot .; \
		fi

.PHONY: yamllint
yamllint: ## Runs the yamllint linter.
	@set -euo pipefail; \
		set -euo pipefail; \
		extraargs=""; \
		if [ "$(OUTPUT_FORMAT)" == "github" ]; then \
			extraargs="-f github"; \
		fi; \
		yamllint --strict -c .yamllint.yaml . $$extraargs

.PHONY: eslint
eslint: node_modules/.installed ## Runs eslint.
	@set -euo pipefail; \
		if [ "$(OUTPUT_FORMAT)" == "github" ]; then \
			set -euo pipefail; \
			exit_code=0; \
			while IFS="" read -r p && [ -n "$$p" ]; do \
				file=$$(echo "$$p" | jq -c '.filePath // empty' | tr -d '"'); \
				while IFS="" read -r m && [ -n "$$m" ]; do \
					severity=$$(echo "$$m" | jq -c '.severity // empty' | tr -d '"'); \
					line=$$(echo "$$m" | jq -c '.line // empty' | tr -d '"'); \
					endline=$$(echo "$$m" | jq -c '.endLine // empty' | tr -d '"'); \
					col=$$(echo "$$m" | jq -c '.column // empty' | tr -d '"'); \
					endcol=$$(echo "$$m" | jq -c '.endColumn // empty' | tr -d '"'); \
					message=$$(echo "$$m" | jq -c '.message // empty' | tr -d '"'); \
					exit_code=1; \
					case $$severity in \
					"1") \
						echo "::warning file=$${file},line=$${line},endLine=$${endline},col=$${col},endColumn=$${endcol}::$${message}"; \
						;; \
					"2") \
						echo "::error file=$${file},line=$${line},endLine=$${endline},col=$${col},endColumn=$${endcol}::$${message}"; \
						;; \
					esac; \
				done <<<$$(echo "$$p" | jq -c '.messages[]'); \
			done <<<$$(./node_modules/.bin/eslint --max-warnings 0 -f json src/**/*.ts | jq -c '.[]'); \
			exit "$${exit_code}"; \
		else \
			./node_modules/.bin/eslint --max-warnings 0 src/**/*.ts; \
		fi
