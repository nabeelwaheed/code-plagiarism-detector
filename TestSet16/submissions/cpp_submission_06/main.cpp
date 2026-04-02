#include "command_engine.hpp"

#include <iostream>
#include <string>
#include <unordered_map>

int main() {
    std::unordered_map<std::string, int> state;
    bool quit = false;
    std::string line;

    std::cout << "Mini Command Parser. Type 'help' for commands.\n";

    while (!quit) {
        std::cout << "> ";
        if (!std::getline(std::cin, line)) {
            break;
        }

        auto tokens = splitTokens(line);
        CommandResult result = runCommand(tokens, state, quit);

        if (!result.message.empty()) {
            std::cout << (result.ok ? "ok: " : "err: ") << result.message << '\n';
        }
    }

    std::cout << "Session ended. Keys stored: " << state.size() << '\n';
    return 0;
}
