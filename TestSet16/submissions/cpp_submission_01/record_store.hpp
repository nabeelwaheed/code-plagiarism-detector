#ifndef RECORD_STORE_HPP
#define RECORD_STORE_HPP

#include <string>
#include <vector>

struct StudentRecord {
    int id;
    std::string name;
    std::string major;
    int year;
    double gpa;
};

bool loadRecordsCsv(const std::string &path, std::vector<StudentRecord> &records);
bool saveRecordsCsv(const std::string &path, const std::vector<StudentRecord> &records);
void addOrUpdateRecord(std::vector<StudentRecord> &records, const StudentRecord &incoming);
bool deleteRecord(std::vector<StudentRecord> &records, int id);
StudentRecord *findRecord(std::vector<StudentRecord> &records, int id);
void sortById(std::vector<StudentRecord> &records);
void printRecords(const std::vector<StudentRecord> &records);
std::vector<StudentRecord> filterByMajor(const std::vector<StudentRecord> &records, const std::string &major);

#endif
