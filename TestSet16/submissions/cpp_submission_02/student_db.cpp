#include "student_db.hpp"

#include <algorithm>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <sstream>

static std::string strip(const std::string &v) {
    std::size_t left = v.find_first_not_of(" \t\r\n");
    std::size_t right = v.find_last_not_of(" \t\r\n");
    if (left == std::string::npos) {
        return "";
    }
    return v.substr(left, right - left + 1);
}

Learner *searchLearner(std::vector<Learner> &rows, int sid) {
    for (auto &r : rows) {
        if (r.sid == sid) {
            return &r;
        }
    }
    return nullptr;
}

void upsertLearner(std::vector<Learner> &rows, const Learner &value) {
    if (Learner *slot = searchLearner(rows, value.sid)) {
        *slot = value;
    } else {
        rows.push_back(value);
    }
}

bool importCsv(const std::string &filename, std::vector<Learner> &rows) {
    std::ifstream in(filename);
    std::string line;
    if (!in) {
        return false;
    }

    while (std::getline(in, line)) {
        Learner x{};
        std::stringstream ss(line);
        std::string token;

        if (!std::getline(ss, token, ',')) continue;
        x.sid = std::stoi(strip(token));

        if (!std::getline(ss, token, ',')) continue;
        x.fullName = strip(token);

        if (!std::getline(ss, token, ',')) continue;
        x.program = strip(token);

        if (!std::getline(ss, token, ',')) continue;
        x.level = std::stoi(strip(token));

        if (!std::getline(ss, token, ',')) continue;
        x.cgpa = std::stod(strip(token));

        upsertLearner(rows, x);
    }

    return true;
}

bool exportCsv(const std::string &filename, const std::vector<Learner> &rows) {
    std::ofstream out(filename);
    if (!out) {
        return false;
    }

    for (const auto &r : rows) {
        out << r.sid << ',' << r.fullName << ',' << r.program << ',' << r.level << ',' << r.cgpa << '\n';
    }
    return true;
}

bool eraseLearner(std::vector<Learner> &rows, int sid) {
    auto pivot = std::remove_if(rows.begin(), rows.end(), [sid](const Learner &r) { return r.sid == sid; });
    if (pivot == rows.end()) {
        return false;
    }
    rows.erase(pivot, rows.end());
    return true;
}

void orderBySid(std::vector<Learner> &rows) {
    std::sort(rows.begin(), rows.end(), [](const Learner &a, const Learner &b) {
        return a.sid < b.sid;
    });
}

void printTable(const std::vector<Learner> &rows) {
    std::cout << "\nSID    Name                  Program         Level CGPA\n";
    std::cout << "-------------------------------------------------------\n";
    for (const auto &r : rows) {
        std::cout << std::left << std::setw(7) << r.sid
                  << std::setw(22) << r.fullName
                  << std::setw(16) << r.program
                  << std::setw(6) << r.level
                  << std::fixed << std::setprecision(2) << r.cgpa << '\n';
    }
}

std::vector<Learner> whereProgram(const std::vector<Learner> &rows, const std::string &program) {
    std::vector<Learner> out;
    for (const auto &r : rows) {
        if (r.program == program) {
            out.push_back(r);
        }
    }
    return out;
}
