#include "record_store.hpp"

#include <algorithm>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <sstream>

static std::string trim(const std::string &s) {
    std::size_t first = s.find_first_not_of(" \t\r\n");
    std::size_t last = s.find_last_not_of(" \t\r\n");
    if (first == std::string::npos) {
        return "";
    }
    return s.substr(first, last - first + 1);
}

bool loadRecordsCsv(const std::string &path, std::vector<StudentRecord> &records) {
    std::ifstream input(path);
    std::string line;
    if (!input) {
        return false;
    }

    while (std::getline(input, line)) {
        std::stringstream ss(line);
        std::string token;
        StudentRecord row{};

        if (!std::getline(ss, token, ',')) continue;
        row.id = std::stoi(trim(token));

        if (!std::getline(ss, token, ',')) continue;
        row.name = trim(token);

        if (!std::getline(ss, token, ',')) continue;
        row.major = trim(token);

        if (!std::getline(ss, token, ',')) continue;
        row.year = std::stoi(trim(token));

        if (!std::getline(ss, token, ',')) continue;
        row.gpa = std::stod(trim(token));

        addOrUpdateRecord(records, row);
    }

    return true;
}

bool saveRecordsCsv(const std::string &path, const std::vector<StudentRecord> &records) {
    std::ofstream output(path);
    if (!output) {
        return false;
    }

    for (const auto &r : records) {
        output << r.id << ',' << r.name << ',' << r.major << ',' << r.year << ',' << r.gpa << '\n';
    }

    return true;
}

StudentRecord *findRecord(std::vector<StudentRecord> &records, int id) {
    for (auto &r : records) {
        if (r.id == id) {
            return &r;
        }
    }
    return nullptr;
}

void addOrUpdateRecord(std::vector<StudentRecord> &records, const StudentRecord &incoming) {
    StudentRecord *existing = findRecord(records, incoming.id);
    if (existing) {
        *existing = incoming;
        return;
    }
    records.push_back(incoming);
}

bool deleteRecord(std::vector<StudentRecord> &records, int id) {
    auto it = std::remove_if(records.begin(), records.end(), [id](const StudentRecord &r) {
        return r.id == id;
    });
    if (it == records.end()) {
        return false;
    }
    records.erase(it, records.end());
    return true;
}

void sortById(std::vector<StudentRecord> &records) {
    std::sort(records.begin(), records.end(), [](const StudentRecord &a, const StudentRecord &b) {
        return a.id < b.id;
    });
}

void printRecords(const std::vector<StudentRecord> &records) {
    std::cout << "\nID     Name                  Major           Year  GPA\n";
    std::cout << "--------------------------------------------------------\n";
    for (const auto &r : records) {
        std::cout << std::left << std::setw(6) << r.id
                  << std::setw(22) << r.name
                  << std::setw(16) << r.major
                  << std::setw(6) << r.year
                  << std::fixed << std::setprecision(2) << r.gpa << '\n';
    }
}

std::vector<StudentRecord> filterByMajor(const std::vector<StudentRecord> &records, const std::string &major) {
    std::vector<StudentRecord> filtered;
    for (const auto &r : records) {
        if (r.major == major) {
            filtered.push_back(r);
        }
    }
    return filtered;
}
