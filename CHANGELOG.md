# 1.0.0 (2025-12-17)


### Bug Fixes

* Add missing Any import to api.py ([36e8989](https://github.com/0xSero/vllm-studio/commit/36e8989e12ee4cde272bcf7112d15aee7dbeee85))
* Add Request type annotation to proxy endpoint ([63d1e71](https://github.com/0xSero/vllm-studio/commit/63d1e71fbffe2ececa240ce773c12891d38a1819))
* **chat:** Add border to message input box ([1bee650](https://github.com/0xSero/vllm-studio/commit/1bee6500a18865e4c0d41e78c69556a9ef5ce342))
* **chat:** dedupe streaming and parse <tool_call> blocks ([1cceb96](https://github.com/0xSero/vllm-studio/commit/1cceb9633855607370cb2c63dcbd567cc5377bfe))
* **chat:** include tool results in context and cache repeats ([77cddea](https://github.com/0xSero/vllm-studio/commit/77cddea2122d76f0f0e7184aed4bf7885ea4e3ea))
* **chat:** persist sessions, auto-title, and stabilize tool loops ([f48194c](https://github.com/0xSero/vllm-studio/commit/f48194c703dd34ae6d0bea7905697f468e879d01))
* **chat:** recover tools/artifacts and soften switch lock ([4bbb6d0](https://github.com/0xSero/vllm-studio/commit/4bbb6d03a790b3245c77b3bc7b40a5f4bd5d73af))
* **chat:** request-level token accounting ([bb68d87](https://github.com/0xSero/vllm-studio/commit/bb68d8776eb2e41be3d7a7d87c9b3a3a9070a80d))
* **chat:** stop repeated tool loops and surface think artifacts ([d86281c](https://github.com/0xSero/vllm-studio/commit/d86281c010587137a19eebda2cfdcbfe2bfa2ea4))
* **frontend:** improve React artifact sandbox ([c0d75c2](https://github.com/0xSero/vllm-studio/commit/c0d75c28d9577b44b5f340a3ce17c7596c457683))
* **frontend:** render svg/js artifacts and TSX ([5372c6d](https://github.com/0xSero/vllm-studio/commit/5372c6d4434bff78cc6aaa504da9f90814ea7c68))
* **mermaid:** debounce rendering and suppress noisy errors ([a3a86be](https://github.com/0xSero/vllm-studio/commit/a3a86beabfc05f11b1f368806f6b67da79a8487a))


### Features

* Add 12 LMStudio-like features to vLLM Studio ([0b4daae](https://github.com/0xSero/vllm-studio/commit/0b4daae6e7ae75bdbe1ed19dd11cb7ddbc830442))
* Add auto-model-switching on inference requests ([284d1bf](https://github.com/0xSero/vllm-studio/commit/284d1bfd937e7a14611a84790f03e0790885beb7))
* Add MCP and skills support ([ae6e1d7](https://github.com/0xSero/vllm-studio/commit/ae6e1d78de6d1d50a4dd891cf71cb1b085f12447))
* Add OpenWebUI integration and update documentation ([78af48a](https://github.com/0xSero/vllm-studio/commit/78af48af25aa84bf95bacbcdba6995d302fc6ab5))
* Add proxy code for Anthropic/OpenAI format translation ([b24035b](https://github.com/0xSero/vllm-studio/commit/b24035bab317ba1088c4e902d19857e5260ea5a1))
* Add web UI dashboard for model management ([89d853c](https://github.com/0xSero/vllm-studio/commit/89d853c42588d4b6fd8ec34b30feb6ae6d0cfcd4))
* **chat:** Add Next.js frontend with chat UI improvements ([0da8a08](https://github.com/0xSero/vllm-studio/commit/0da8a086aadad3dfcf3b41448e74268483479e8c))
* **chat:** multi-model sessions, forking, and token usage ([fd978f8](https://github.com/0xSero/vllm-studio/commit/fd978f864fbb13605d2fc0ca34e27c092bd0fb6f))
* **chat:** polish header, tool arg repair, and mermaid hardening ([997aa64](https://github.com/0xSero/vllm-studio/commit/997aa64c475bb1f167248b1c9b4829918fbff3a4))
* Multi-model support, rolling metrics, chat improvements ([aa038b8](https://github.com/0xSero/vllm-studio/commit/aa038b83213b61929a78aad64cf328f4b30a0009))
* OpenWebUI integration with vLLM Studio ([bf05036](https://github.com/0xSero/vllm-studio/commit/bf05036f128d8dc3fd814b236e89e7e856ab133a))
* **studio:** improve MCP tools, recipes, and parsing ([9d25f53](https://github.com/0xSero/vllm-studio/commit/9d25f532e485065813d57fc5defd17c51bf29277))
* **ui:** Add full UI for all vLLM Studio features ([6eef4e9](https://github.com/0xSero/vllm-studio/commit/6eef4e924c79f2d7f053ca05287e4dd6a7c87c12))
* **ui:** command palette and chat usage/export ([c0d98d8](https://github.com/0xSero/vllm-studio/commit/c0d98d8be0e99ab55edbf2ca0c0fe5e8d3ba835e))
* **ui:** simplify mobile nav and chat controls ([71768b5](https://github.com/0xSero/vllm-studio/commit/71768b58e9f866c66ef52adc3804c427dd729cd3))
* **ui:** simplify recipes and logs experience ([558c10f](https://github.com/0xSero/vllm-studio/commit/558c10f011e1f4fe5831ffc81efd0097c38be5da))
* vLLM Studio v1 - Model management API for vLLM/SGLang ([2cfa401](https://github.com/0xSero/vllm-studio/commit/2cfa40137218d796e395e7aacb2f838e24eadd18))

# Changelog

All notable changes to this project are documented in this file.

This project uses semantic-release with Conventional Commits.
