# PAVO Network Traffic App for Splunk Documentation

## Summary

App for exporting and reporting on Network Traffic events.

|                            |                                                |
| -------------------------- | ---------------------------------------------- |
| Author                     | Aplura, LLC.                                   |
| App Version                | 1.2.4                                          |
| App Build                  | 6                                              |
| Platforms                  | Splunk Enterprise                              |
| Splunk Enterprise versions | 8.0, 7.3, 7.2, 7.1, 7.0                        |
| Creates an index           | False                                          |
| Implements summarization   | Currently, the app does not generate summaries |
| Summary Indexing           | False                                          |
| Data Model Acceleration    | If Enabled                                     |
| Report Acceleration        | False                                          |

## Scripts and binaries

This App provides the following scripts:

|         |                                  |
| ------- | -------------------------------- |
| Diag.py | For use with the `diag` command. |

# About PAVO Network Traffic App for Splunk

## Overview

Very often, network traffic events can provide a lot of information about misconfigurations, potential attacks, and user activity. This app provides searches and dashboards based on the Splunk Common Information Model to help provide insight into your network traffic.

## A note on Splunk Data Model Acceleration and Disk Space

This app requires data model acceleration, which will use additional disk space. If you are using the Splunk App for Enterprise Security, this is already enabled, and should have been factored into your retention policies. If not, you should review the documentation on [data model acceleration, how it uses disk space, and how to plan for it](http://docs.splunk.com/Documentation/Splunk/latest/Knowledge/Acceleratedatamodels#Data_model_summary_size_on_disk).

## A note on the Splunk Common Information Model

As mentioned above, the app uses the CIM for network traffic events. The CIM allows you to take events from a number of network traffic sources or products, and report on them in one cohesive manner, using a common set of names for fields and event types.

## A note on the Network Traffic Data Model, src, dest, src_ip, and dest_ip

The Network Traffic data model includes both `src`, `dest` fields, and `src_ip`, `dest_ip` fields. For this app, we have opted to use the `*_ip` versions of these fields, in case hostnames are being used for the other fields. Make sure your field extractions are correctly populating these fields.

## Available Dashboards

### Network Traffic Overview

Provides a general overview of the network traffic events.

### IP Profile

Provides information around an IP address (both `dest_ip` and `src_ip`), including traffic from, to, and possible open ports.

### Transport Information

Information around the transport field of events (TCP, UDP, ICMP, etc.).

### Port Information

This form provides information based on the destination port (`dest_port`) field of events, such as the traffic over time, conversations, and sources.

### Internal and External Traffic

Currently just top destinations (external and from external to internal). The determination on internal vs. external is configured by macros. See the App Configuration Macros section of this document.

### Scanning Activity

This dashboard provides the top potential scanners (both host and port scanners) based on network traffic.

### Geographic Information

This is based on the geo-ip information provided by the built-in IP location from Splunk. Internal traffic is excluded from this page. Note: The searches on this page may take a while to load.

### Network Traffic Search

A form which allows for searching network traffic events based on a few different parameters.

### VPN Traffic Overview

This dashboard provides an overview of VPN traffic that has been observed. This dashboard uses accelerated data models and macros. Please make sure you accelerate the `Network Traffic` and `Network Sessions` data models. It is possible that there are different values for `action` and `signature`. This app expects `signature=login`, `signature=logout`, `action=success` or `action=failure`.

### Data Transparency Overview

This dashboard provides field information from the data models used to retrieve data for this application. Included information includes indexes and sourcetypes found in the data model. This dashboard also shows fields and constraints in the data models.

### Sourcetype Information

Information about the sourcetypes which are present in the accelerated data. Note: This dashboard is not shown in the navigation bar. To view this dashboard, go to `Settings` -> `User Interface` -> `Views` -> and select the Open option next to the sourcetype_information item in the list.

### About

A simple HTML version of this document. Note: This dashboard is not shown in the navigation bar. To view this dashboard, go to `Settings` -> `User Interface` -> `Views` -> and select the Open option next to the About item in the list.

# Support and resources

## Questions and answers

Access questions and answers specific to PAVO Network Traffic App for Splunk at [https://answers.splunk.com/app/questions/4229.html](https://answers.splunk.com/app/questions/4229.html) . Be sure to tag your question with the App.

## Support

  - Support Email: [customersupport@aplura.com](mailto:customersupport%40aplura.com)

  - Support Offered: Splunk Answers

# Prerequisites

Because this App runs on Splunk Enterprise, all of the [Splunk Enterprise system requirements](https://docs.splunk.com/Documentation/Splunk/latest/Installation/Systemrequirements) apply.

This app depends on data models included in the Splunk Common Information Model Add-on, specifically the Network Traffic data model. Please review the information on [installing and using the Splunk Common Information Model Add-on](http://docs.splunk.com/Documentation/CIM/latest/User/Install) and information on [configuring the acceleration on the data model](http://docs.splunk.com/Documentation/Splunk/latest/Knowledge/Acceleratedatamodels#Enable_persistent_acceleration_for_a_data_model).

The Splunk Common Information Model Add-on can be downloaded from [Splunkbase](https://apps.splunk.com/app/1621/).

This app has been tested with versions 4.9 of the CIM add-on.

In order to make the app respond and load quickly, accelerated data models are used to provide summary data. For this data to be available, the Network Traffic data model must be accelerated. Information on how to enable acceleration for the Network Traffic data model can be found [here](http://docs.splunk.com/Documentation/Splunk/latest/Knowledge/Managedatamodels#Enable_data_model_acceleration). The data model must be accelerated for the length of time for which you would like to see reporting.

The `Breakdown of Sourcetypes in Indexes in Dataset` panel on the `Data Transparency Overview` dashboard will only be seen if the `Sankey Diagram` visualization is installed.

The Sankey Diagram Visualization can be downloaded from [Sankey Diagram Custom Visualization](https://splunkbase.splunk.com/app/3112/).

This app may require some configuration before it will work properly (outside of the configuration of the Data Model Acceleration). In particular, you may need to edit the configuration macros, as well as the lookup which populates the Device dropdown found on many of the dashboards.

This macro contains the search which is used to populate the Devices dropdown found on many of the dashboards. By default this is the auto-generated lookup, however, the macro can be edited to point to another lookup as needed.

This macro contains a partial search which determines when a network traffic events destination IP address is external to your network. By default this will exclude private IP addresses, but can be edited to reflect your own network configuration. Note: this search snippet is used in searches using the accelerated data models and the `tstats` command. While the normal SPL does support CIDR, `tstats` does not. Make sure your search syntax will work with the `tstats` command.

This macro contains a partial search which determines when a network traffic events source IP address is external to your network. By default this will exclude private IP addresses, but can be edited to reflect your own network configuration. Note: this search snippet is used in searches using the accelerated data models and the `tstats` command. While the normal SPL does support CIDR, `tstats` does not. Make sure your search syntax will work with the `tstats` command.

For the `Device` dropdown, present on many of the dashboards, you can use the auto-generated lookup, which runs every morning at 2 am. If your Network_Traffic data model is populated, you can run the saved search `network_traffic_dvc_auto_gen` to populate the dropdown.

The lookup has two fields: `dvc` and `device_name`. `device_name` can be a description of the device. `dvc` can be wild-carded (not CIDR, as that is not available in `tstats` searches used with the accelerated data models). The search used to populate this dropdown can be configured using the network_traffic_dvcs macro.

  - References

-----

  - [Splunk Common Information Model Add-on Docs](https://docs.splunk.com/Documentation/CIM/latest/User/Overview)

  - Splunk Common Information Model add-on Network Traffic data model [https://docs.splunk.com/documentation/CIM/latest/user/NetworkTraffic](https://docs.splunk.com/documentation/CIM/latest/user/NetworkTraffic)

  - Downloads

-----

  - [Splunk Common Information Model Add-on](https://apps.splunk.com/app/1621/)

<!-- end list -->

  - Downloads

-----

  - [Sankey Diagram Custom Visualization](https://splunkbase.splunk.com/app/3112/)

# Installation and Configuration

Reminder: This app should be installed on a search head where the Network Traffic data model has been accelerated. More information on installing or upgrading Splunk apps can be found [here](http://docs.splunk.com/Documentation/Splunk/latest/Admin/Wheretogetmoreapps).

## Download

Download PAVO Network Traffic App for Splunk at [https://splunkbase.splunk.com/app/4229](https://splunkbase.splunk.com/app/4229).

### Installation Process Overview

  - Make sure the field extractions and tags on your network traffic events are correct.

  - Install the Splunk Common Information Model Add-on (skip if you are installing on an ES search head).

  - Install the PAVO Network Traffic App for Splunk for Splunk.

  - Enable accelerations on the Network Traffic data model (skip if you are installing on an ES search head).

  - Wait for the accelerations to start. After the acceleration searches have run, you should start seeing the dashboards populate.

  - Restart Splunk.

  - Continue with App Configuration.

### Deploy to single server instance

Follow these steps to install the app in a single server instance of Splunk Enterprise:

1.  Deploy as you would any App, and restart Splunk.

2.  Configure.

### Deploy to Splunk Cloud

1.  Have your Splunk Cloud Support handle this installation.

### Deploy to a Distributed Environment

1.  For each Search Head in the environment, deploy a copy of the App.

# User Guide

## Configure PAVO Network Traffic App for Splunk

  - Install the App according to your environment (see steps above)

## Lookups

PAVO Network Traffic App for Splunk contains the following lookup files.

  - None

## Event Generator

PAVO Network Traffic App for Splunk does not include an event generator.

## Acceleration

1.  Summary Indexing: No

2.  Data Model Acceleration: If Enabled

3.  Report Acceleration: No

# Third Party Notices

Version 1.2.4 of PAVO Network Traffic App for Splunk incorporates the following Third-party software or third-party services.

  - None

## Known Issues

Version 1.2.4 of PAVO Network Traffic App for Splunk has the following known issues:

  - None

# Release notes

## Version 1.2.3

  - Bug
    
      - [APL029-419] - Change traffic over time by action to line chart
    
      - [APL029-419] - Fix time being not being passed to drilldown dashboards correctly
    
      - [APL029-341] - Configure checklist.conf

  -   - Improvement
        
          - [ANTFS-16] - Added VPN dashboard
        
          - [ANTFS-16] - ADded data transparency dashboard under advanced menu

## Version 1.2.2

  - Bug
    
      - [ANTAFS-13] - Change Titles and Loyout of Sourcetype Information dashboard

### Version 1.2.1

  - Bug
    
      - [ANTAFS-10] - Misspelling

  - Task
    
      - [ANTAFS-6] - Rename app

## Version 1.2.0

  - Initial Release

# [PAVO Network Traffic App for Splunk](#)

### Navigation

### Related Topics

  - [Documentation overview](#)

2018, Aplura, LLC. | Powered by [Sphinx 3.0.4](http://sphinx-doc.org/) & [Alabaster 0.7.12](https://github.com/bitprophet/alabaster)
