#ifndef COMMAND_ENGINE_HPP
#define COMMAND_ENGINE_HPP

#include <string>
#include <unordered_map>
#include <vector>

struct CommandResult {
    bool ok;
    std::string message;
};

std::vector<std::string> splitTokens(const std::string &line);
CommandResult runCommand(const std::vector<std::string> &tokens, std::unordered_map<std::string, int> &state, bool &quit);

#endif
