#ifndef STUDENT_DB_HPP
#define STUDENT_DB_HPP

#include <string>
#include <vector>

struct Learner {
    int sid;
    std::string fullName;
    std::string program;
    int level;
    double cgpa;
};

bool importCsv(const std::string &filename, std::vector<Learner> &rows);
bool exportCsv(const std::string &filename, const std::vector<Learner> &rows);
void upsertLearner(std::vector<Learner> &rows, const Learner &value);
bool eraseLearner(std::vector<Learner> &rows, int sid);
Learner *searchLearner(std::vector<Learner> &rows, int sid);
void orderBySid(std::vector<Learner> &rows);
void printTable(const std::vector<Learner> &rows);
std::vector<Learner> whereProgram(const std::vector<Learner> &rows, const std::string &program);

#endif
