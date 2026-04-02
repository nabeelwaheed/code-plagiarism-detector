#include "command_engine.hpp"

#include <sstream>

std::vector<std::string> splitTokens(const std::string &line) {
    std::vector<std::string> tokens;
    std::stringstream ss(line);
    std::string token;
    while (ss >> token) {
        tokens.push_back(token);
    }
    return tokens;
}

static int toInt(const std::string &text, bool &ok) {
    try {
        ok = true;
        return std::stoi(text);
    } catch (...) {
        ok = false;
        return 0;
    }
}

CommandResult runCommand(const std::vector<std::string> &tokens, std::unordered_map<std::string, int> &state, bool &quit) {
    if (tokens.empty()) {
        return {true, ""};
    }

    const std::string &cmd = tokens[0];

    if (cmd == "help") {
        return {true, "Commands: set <k> <v>, get <k>, add <k> <n>, del <k>, list, exit"};
    }

    if (cmd == "exit") {
        quit = true;
        return {true, "bye"};
    }

    if (cmd == "set") {
        bool ok = false;
        if (tokens.size() != 3) {
            return {false, "usage: set <key> <value>"};
        }
        int value = toInt(tokens[2], ok);
        if (!ok) {
            return {false, "value must be integer"};
        }
        state[tokens[1]] = value;
        return {true, "stored"};
    }

    if (cmd == "get") {
        if (tokens.size() != 2) {
            return {false, "usage: get <key>"};
        }
        auto it = state.find(tokens[1]);
        if (it == state.end()) {
            return {false, "missing key"};
        }
        return {true, tokens[1] + "=" + std::to_string(it->second)};
    }

    if (cmd == "add") {
        bool ok = false;
        if (tokens.size() != 3) {
            return {false, "usage: add <key> <delta>"};
        }
        int delta = toInt(tokens[2], ok);
        if (!ok) {
            return {false, "delta must be integer"};
        }
        state[tokens[1]] += delta;
        return {true, tokens[1] + " updated"};
    }

    if (cmd == "del") {
        if (tokens.size() != 2) {
            return {false, "usage: del <key>"};
        }
        std::size_t removed = state.erase(tokens[1]);
        return {removed ? true : false, removed ? "deleted" : "missing key"};
    }

    if (cmd == "list") {
        if (state.empty()) {
            return {true, "(empty)"};
        }
        std::string out;
        for (const auto &kv : state) {
            if (!out.empty()) out += "; ";
            out += kv.first + "=" + std::to_string(kv.second);
        }
        return {true, out};
    }

    return {false, "unknown command"};
}
